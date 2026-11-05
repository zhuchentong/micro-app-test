#!/usr/bin/env node
/**
 * dev 交互启动器：自动发现 apps/<name>/ 下含 dev script 的应用，
 * 终端交互选择要启动的子应用与宿主，统一托管并行 dev 进程。
 *
 * 用法:
 *   node scripts/dev.mjs                # 交互选择(非 TTY 时启动全部)
 *   node scripts/dev.mjs --all          # 启动全部应用(跳过交互)
 *   node scripts/dev.mjs <名字...>       # 直达模式，跳过交互(名字含宿主即含宿主)
 *   node scripts/dev.mjs --host 0.0.0.0 # 全网卡监听并打印局域网分享地址(--host 语义同 vite)
 *   node scripts/dev.mjs --allow-lan    # 等价裸 --host(监听所有地址)并打印局域网分享地址
 *
 * --host 转发给各 app 的 vp dev(无值 = 监听所有地址);裸 --host 紧跟已知应用名时
 * 按位置参数处理(应用名与主机名空间不相交,无歧义):
 *   nr dev --host micro-app-a ≡ nr dev micro-app-a --host
 *
 * 宿主识别:package.json 的 dependencies 含 wujie。
 * 端口提示:提取 vite.config.ts 中 server.port 字面量(与 stop.mjs 相同规则)。
 * 端口预检:启动前检测选中应用的端口占用,被占用时先执行 stop.mjs 清理本仓库残留进程。
 * 启动顺序:先启动子应用,待其配置端口就绪后再启动宿主(避免宿主先于子应用就绪)。
 */
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { AutocompletePrompt } from "@clack/core";

/**
 * 空格选中补丁:clack 的 AutocompletePrompt 仅在导航模式(按过 ↑/↓)下把空格当选中键,
 * 初始输入模式下空格会被插入搜索词(经 fuzzyMatch 后过滤为空,表现为按下无效)。
 * 这里让空格恒为动作键(不进搜索词),并在 prompt() 时挂 key 监听,
 * 非导航模式下也执行 toggleSelected(监听晚于内部 #u 注册,导航模式不重复 toggle)。
 * 依赖 _isActionKey/prompt 内部 API,升级 @clack/core 时需回归验证。
 */
const origIsActionKey = AutocompletePrompt.prototype._isActionKey;
const origPrompt = AutocompletePrompt.prototype.prompt;
AutocompletePrompt.prototype._isActionKey = function (char, key) {
  if (key?.name === "space") return true;
  return origIsActionKey.call(this, char, key);
};
AutocompletePrompt.prototype.prompt = function (...args) {
  if (!this.__spaceToggleHooked) {
    this.__spaceToggleHooked = true;
    this.on("key", (char, key) => {
      if (key?.name === "space" && !this.isNavigating && this.focusedValue !== undefined) {
        this.toggleSelected(this.focusedValue);
      }
    });
  }
  return origPrompt.apply(this, args);
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const appsDir = join(repoRoot, "apps");

/**
 * 发现 apps/* 下含 dev script 的应用(按名排序)
 * @returns 应用清单列表:名称、配置端口(无 vite.config.ts 时为空)与是否宿主
 */
function discoverApps() {
  const apps = [];
  const entries = readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(appsDir, entry.name, "package.json"), "utf8"));
    } catch {
      continue;
    }
    if (!pkg.scripts?.dev) continue;
    let port = null;
    try {
      const source = readFileSync(join(appsDir, entry.name, "vite.config.ts"), "utf8");
      const match = source.match(/server:\s*\{[^}]*\bport:\s*(\d+)/);
      if (match) port = Number(match[1]);
    } catch {
      // 无 vite.config.ts 则不显示端口提示
    }
    apps.push({ name: entry.name, port, host: Boolean(pkg.dependencies?.wujie) });
  }
  return apps;
}

/**
 * 查询端口上的监听进程 pid 集合(ss -tlnp,仅 Linux;与 stop.mjs 相同规则)
 * @param port 端口号
 * @returns 占用该端口的 pid 数组(端口空闲或 ss 不可用时为空)
 */
function listenerPids(port) {
  const out = spawnSync("ss", ["-tlnp", "sport", "=", `:${port}`], { encoding: "utf8" });
  if (out.status !== 0) return [];
  const pids = new Set();
  for (const match of out.stdout.matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
  return [...pids];
}

/**
 * 收集本机可分享 IPv4 地址(排除 loopback/link-local),私网前缀优先排序:
 * 192.168 > 10. > 172.16-31 > 其他,避免 docker0 等虚拟网卡地址排在首位。
 * @returns 可分享的 IPv4 地址列表(可能为空)
 */
function lanAddresses() {
  const ips = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family !== "IPv4" || info.internal || info.address.startsWith("169.254.")) continue;
      ips.push(info.address);
    }
  }
  const rank = (ip) => {
    if (ip.startsWith("192.168.")) return 0;
    if (ip.startsWith("10.")) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 3;
  };
  return ips.sort((a, b) => rank(a) - rank(b));
}

/**
 * 启动前端口预检:被占用时先执行 stop.mjs 清理本仓库残留进程,复查仍占用则告警
 * @param targets 待启动的应用清单(仅含配置端口者参与检查)
 */
function ensurePortsFree(targets) {
  const withPort = targets.filter((a) => a.port != null);
  const occupied = withPort.filter((a) => listenerPids(a.port).length > 0);
  if (occupied.length === 0) return;
  console.log(
    `[dev] 端口已被占用(${occupied.map((a) => `${a.name}:${a.port}`).join("、")}),先执行 stop.mjs 清理...`,
  );
  const res = spawnSync(process.execPath, [join(repoRoot, "scripts", "stop.mjs")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    console.warn(`[dev] stop.mjs 异常退出(${res.signal ?? `code ${res.status}`}),继续启动`);
  }
  for (const a of withPort) {
    if (listenerPids(a.port).length > 0) {
      console.warn(`[dev] 端口 ${a.port}(${a.name})仍被占用,可能为仓库外进程,启动后可能冲突`);
    }
  }
}

const apps = discoverApps();
if (apps.length === 0) {
  console.error("[dev] apps/ 下未发现含 dev script 的应用");
  process.exit(1);
}
const hostApp = apps.find((a) => a.host) ?? null;
const subApps = apps.filter((a) => !a.host);
const knownNames = new Set(apps.map((a) => a.name));

/**
 * 子序列模糊匹配:search 中的字符按序(可不连续)出现在 text 中即命中,大小写不敏感。
 * @param search 待匹配的关键字序列
 * @param text 被匹配的目标文本(应用名等)
 * @returns 是否命中(空关键字恒命中)
 */
function fuzzyMatch(search, text) {
  if (!search) return true;
  const s = search.toLowerCase();
  const t = String(text).toLowerCase();
  let si = 0;
  for (let ti = 0; ti < t.length && si < s.length; ti++) {
    if (t[ti] === s[si]) si++;
  }
  return si === s.length;
}

// ---------- 选择 ----------
// --host 转发给各 app 的 vp dev(vite 语义:无值 = 监听所有地址),其余 - 开头选项不支持。
// --allow-lan 为布尔开关,解析完成后等价注入裸 --host(显式 --host 优先,不覆盖其值)。
// 裸 --host 在 vite 语义下会吞掉紧跟的 token;此处当下一 token 是已知应用名时按位置参数处理:
//   nr dev --host micro-app-a ≡ nr dev micro-app-a --host
const args = process.argv.slice(2);
const hostArgs = [];
const nameArgs = [];
const badArgs = [];
let allFlag = false;
let allowLan = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--all") {
    allFlag = true;
  } else if (arg === "--allow-lan") {
    allowLan = true; // 布尔开关,不消费下一 token,不影响位置参数(应用名)解析
  } else if (arg === "--host") {
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("-") && knownNames.has(next)) {
      hostArgs.push("--host"); // 已知应用名 → 按位置参数,host 取无值语义
    } else if (next !== undefined && !next.startsWith("-")) {
      hostArgs.push("--host", next); // 常规:消费值,不落入下方 unknown 校验
      i++;
    } else {
      hostArgs.push("--host");
    }
  } else if (arg.startsWith("--host=")) {
    hostArgs.push("--host", arg.slice("--host=".length));
  } else if (arg.startsWith("-")) {
    badArgs.push(arg);
  } else {
    nameArgs.push(arg);
  }
}
// --allow-lan 是裸 --host 的便捷别名;已显式给出 --host(裸或有值)时不重复注入
if (allowLan && !hostArgs.includes("--host")) {
  hostArgs.push("--host");
}
if (badArgs.length > 0) {
  console.error(`[dev] 不支持的选项:${badArgs.join(" ")}`);
  process.exit(1);
}
if (allFlag && nameArgs.length > 0) {
  console.error(`[dev] --all 不能与位置参数(应用名)同时使用:${nameArgs.join(" ")}`);
  process.exit(1);
}
const unknown = nameArgs.filter((n) => !knownNames.has(n));
if (unknown.length > 0) {
  console.error(`[dev] 未知应用:${unknown.join(", ")}`);
  console.error(`可用应用:${[...knownNames].join(", ")}`);
  process.exit(1);
}

let selectedNames;
if (allFlag) {
  console.log("[dev] --all,启动全部应用");
  selectedNames = new Set(knownNames);
} else if (nameArgs.length > 0) {
  selectedNames = new Set(nameArgs);
} else if (!process.stdin.isTTY) {
  console.log("[dev] 非交互环境,启动全部应用");
  selectedNames = new Set(knownNames);
} else {
  p.intro("dev 启动器");
  selectedNames = new Set();
  if (subApps.length > 0) {
    const picked = await p.autocompleteMultiselect({
      message: "选择要启动的子应用(输入筛选,空格/Tab 选中,回车确认)",
      options: subApps.map((a) => ({
        value: a.name,
        label: a.name,
        hint: a.port ? `端口 ${a.port}` : undefined,
      })),
      placeholder: "输入应用名筛选…",
      filter: (search, option) => fuzzyMatch(search, option.label ?? String(option.value ?? "")),
      required: false,
    });
    if (p.isCancel(picked)) {
      p.cancel("已取消");
      process.exit(130);
    }
    for (const name of picked) selectedNames.add(name);
  }
  if (hostApp) {
    const withHost = await p.confirm({
      message: `是否启动宿主 ${hostApp.name}${hostApp.port ? `(端口 ${hostApp.port})` : ""}?`,
      initialValue: true,
    });
    if (p.isCancel(withHost)) {
      p.cancel("已取消");
      process.exit(130);
    }
    if (withHost) selectedNames.add(hostApp.name);
  }
  p.outro(`已选择:${[...selectedNames].join("、") || "无"}`);
}

const targets = apps.filter((a) => selectedNames.has(a.name));
if (targets.length === 0) {
  console.log("[dev] 未选择任何应用,退出");
  process.exit(0);
}

// ---------- 端口占用预检 ----------
ensurePortsFree(targets);

// ---------- 进程托管 ----------
const colors = ["\x1b[36m", "\x1b[35m", "\x1b[33m", "\x1b[32m", "\x1b[34m"];
const reset = "\x1b[0m";
const width = Math.max(...targets.map((a) => a.name.length));
const children = new Map();
let shuttingDown = false;
let lastExitCode = 0;

/**
 * 将子进程输出流按行转发到 stdout,逐行附加应用名前缀(缓冲半行防串行)
 * @param stream 子进程可读流(stdout/stderr)
 * @param prefix 行前缀(含着色的应用名)
 */
function pipeWithPrefix(stream, prefix) {
  let buf = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      process.stdout.write(`${prefix} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buf.trim()) process.stdout.write(`${prefix} ${buf}\n`);
  });
}

/** 终止全部子应用进程;幂等(shuttingDown 防重入),并复位终端光标 */
function terminateAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[dev] 正在停止所有应用...");
  for (const proc of children.values()) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill("SIGTERM");
    }
  }
  const deadline = Date.now() + 2000;
  const timer = setInterval(() => {
    const alive = [...children.entries()].filter(([, proc]) => proc.exitCode === null);
    if (alive.length === 0 || Date.now() > deadline) {
      clearInterval(timer);
      for (const [name, proc] of alive) {
        console.warn(`[dev] ${name} 未响应 SIGTERM,强制结束`);
        try {
          process.kill(-proc.pid, "SIGKILL");
        } catch {
          proc.kill("SIGKILL");
        }
      }
      process.exit(0);
    }
  }, 100);
}

process.on("SIGINT", terminateAll);
process.on("SIGTERM", terminateAll);

/**
 * 启动单个应用 dev 服务并转发日志(带应用名前缀着色输出)
 * @param app 应用清单项(name 与 dev 命令)
 * @param colorIndex 前缀颜色序号(按序循环取色,区分不同应用日志)
 */
function launchApp(app, colorIndex) {
  const prefix = `${colors[colorIndex % colors.length]}${app.name.padEnd(width)}${reset}`;
  // detached:独立进程组,便于整组终止(vp run -> vp dev -> vite 进程树)
  // --host 经 -- 分隔符透传给 vp dev(实测无 -- 时参数会被 vp 误传给 node)
  const extraArgs = hostArgs.length > 0 ? ["--", ...hostArgs] : [];
  const proc = spawn("vp", ["run", `${app.name}#dev`, ...extraArgs], {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  children.set(app.name, proc);
  pipeWithPrefix(proc.stdout, prefix);
  pipeWithPrefix(proc.stderr, prefix);
  proc.on("error", (err) => {
    console.error(`[dev] ${app.name} 启动失败:${err.message}`);
    children.delete(app.name);
  });
  proc.on("exit", (code, signal) => {
    lastExitCode = code ?? (signal ? 1 : 0);
    children.delete(app.name);
    console.log(`[dev] ${app.name} 已退出(${signal ?? `code ${code}`})`);
    if (children.size === 0 && !shuttingDown) process.exit(lastExitCode);
  });
}

/**
 * 等待子应用配置端口就绪(轮询 ss,复用预检规则),超时则告警并继续
 * @param subs 子应用清单项列表(含 port 配置者才参与等待)
 * @param timeoutMs 就绪超时上限(默认 30s),超时后告警但不中断启动流程
 */
async function waitSubAppsReady(subs, timeoutMs = 30000) {
  const withPort = subs.filter((a) => a.port != null);
  if (withPort.length === 0) return;
  const pending = new Map(withPort.map((a) => [a.name, a]));
  const deadline = Date.now() + timeoutMs;
  while (pending.size > 0 && Date.now() < deadline) {
    for (const [name, a] of pending) {
      const proc = children.get(name);
      if ((proc && proc.exitCode !== null) || listenerPids(a.port).length > 0) {
        pending.delete(name); // 端口就绪,或进程已退出(不再等待)
      }
    }
    if (pending.size > 0) await new Promise((r) => setTimeout(r, 300));
  }
  if (pending.size > 0) {
    console.warn(`[dev] 等待子应用就绪超时(${[...pending.keys()].join("、")}),仍启动宿主`);
  } else {
    console.log("[dev] 子应用端口就绪,启动宿主");
  }
}

const subTargets = targets.filter((a) => !a.host);
const hostTargets = targets.filter((a) => a.host);

console.log(
  `[dev] 启动 ${subTargets.length} 个子应用:${subTargets.map((a) => a.name).join("、") || "无"}`,
);
for (const app of subTargets) launchApp(app, targets.indexOf(app));

if (hostTargets.length > 0) {
  await waitSubAppsReady(subTargets);
  for (const app of hostTargets) {
    console.log(`[dev] 启动宿主 ${app.name}`);
    launchApp(app, targets.indexOf(app));
  }
  // 显式启用 --host 且宿主有配置端口时,汇总打印局域网分享地址
  // (vite 自身的 Network 行混于多应用日志,不够醒目)
  const hostPort = hostTargets.find((a) => a.port != null)?.port;
  const lan = lanAddresses();
  if (hostArgs.length > 0 && hostPort != null && lan.length > 0) {
    console.log(`[dev] 可分享地址:${lan.map((ip) => `http://${ip}:${hostPort}`).join(" 或 ")}`);
  }
}
