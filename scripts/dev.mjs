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
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const appsDir = join(repoRoot, "apps");

/** 发现 apps/* 下含 dev script 的应用,返回 { name, port, host } 列表(按名排序) */
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
 * @param {string} search
 * @param {string} text
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

// ---------- 进程托管 ----------
const colors = ["\x1b[36m", "\x1b[35m", "\x1b[33m", "\x1b[32m", "\x1b[34m"];
const reset = "\x1b[0m";
const width = Math.max(...targets.map((a) => a.name.length));
const children = new Map();
let shuttingDown = false;
let lastExitCode = 0;

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

console.log(`[dev] 启动 ${targets.length} 个应用:${targets.map((a) => a.name).join("、")}`);
for (const [i, app] of targets.entries()) {
  const prefix = `${colors[i % colors.length]}${app.name.padEnd(width)}${reset}`;
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
