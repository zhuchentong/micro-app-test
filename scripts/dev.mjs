#!/usr/bin/env node
/**
 * dev 交互启动器：自动发现 apps/<name>/ 下含 dev script 的应用，
 * 终端交互选择要启动的子应用与宿主，统一托管并行 dev 进程。
 *
 * 用法:
 *   node scripts/dev.mjs                # 交互选择(非 TTY 时启动全部)
 *   node scripts/dev.mjs <名字...>       # 直达模式，跳过交互(名字含宿主即含宿主)
 *
 * 宿主识别:package.json 的 dependencies 含 wujie。
 * 端口提示:提取 vite.config.ts 中 server.port 字面量(与 stop.mjs 相同规则)。
 * 端口预检:启动前检测选中应用的端口占用,被占用时先执行 stop.mjs 清理本仓库残留进程。
 * 启动顺序:先启动子应用,待其配置端口就绪后再启动宿主(避免宿主先于子应用就绪)。
 */
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

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
const args = process.argv.slice(2);
const badArgs = args.filter((a) => a.startsWith("-"));
if (badArgs.length > 0) {
  console.error(`[dev] 不支持的选项:${badArgs.join(" ")}`);
  process.exit(1);
}
const unknown = args.filter((n) => !knownNames.has(n));
if (unknown.length > 0) {
  console.error(`[dev] 未知应用:${unknown.join(", ")}`);
  console.error(`可用应用:${[...knownNames].join(", ")}`);
  process.exit(1);
}

let selectedNames;
if (args.length > 0) {
  selectedNames = new Set(args);
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
  const proc = spawn("vp", ["run", `${app.name}#dev`], {
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
}
