#!/usr/bin/env node
/**
 * 停止本仓库的全部 dev 服务(vp run stop)。
 *
 * 自动发现 apps/<name>/vite.config.ts 中 server.port 的端口并终止监听进程,
 * 新增子应用无需登记(端口需写为字面量,不支持变量/环境变量拼装)。
 *
 * 安全护栏:仅终止本仓库进程与工作目录已删除的孤儿进程(Linux /proc/<pid>/cwd),
 * 端口被其他在用目录的无关进程占用时跳过并告警。仅支持 Linux。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 从 apps/* 的 vite.config.ts 提取 dev 端口
 * @returns { name, port } 列表(仅含配置了端口的目录)
 */
function discoverPorts() {
  const entries = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = join(appsDir, entry.name, "vite.config.ts");
    if (!existsSync(configPath)) continue;
    const source = readFileSync(configPath, "utf8");
    const match = source.match(/server:\s*\{[^}]*\bport:\s*(\d+)/);
    if (!match) {
      console.warn(`[stop] 跳过 ${entry.name}:vite.config.ts 中未找到 server.port 字面量`);
      continue;
    }
    entries.push({ name: entry.name, port: Number(match[1]) });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** 仓库根目录(脚本位于 <root>/scripts/) */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const appsDir = join(repoRoot, "apps");

/**
 * 查询端口上的监听进程 pid 集合
 * @param port 端口号
 * @returns 占用该端口的 pid 数组(去重;ss 失败时输出错误并返回空)
 */
function listenerPids(port) {
  const out = spawnSync("ss", ["-tlnp", "sport", "=", `:${port}`], { encoding: "utf8" });
  if (out.status !== 0) {
    console.error(`[stop] ss 查询端口 ${port} 失败:${out.stderr?.trim()}`);
    return [];
  }
  // 输出形如 users:(("MainThread",pid=123,fd=27)),v4/v6 双栈可能重复,去重
  const pids = new Set();
  for (const match of out.stdout.matchAll(/pid=(\d+)/g)) pids.add(Number(match[1]));
  return [...pids];
}

/**
 * 进程工作目录(内核对已删除目录会在 readlink 结果后追加 " (deleted)")
 * @param pid 进程 id
 * @returns 工作目录绝对路径;进程已退出或无权限时为 null
 */
function procCwd(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`).replace(/ \(deleted\)$/, "");
  } catch {
    return null; // 进程已退出或无权限
  }
}

/**
 * 进程工作目录是否在本仓库内(防止误杀无关进程)
 * @param pid 进程 id
 * @returns 工作目录位于仓库根之下时为 true
 */
function belongsToRepo(pid) {
  const cwd = procCwd(pid);
  // cwd 恰为仓库根时无尾部斜杠,补 "/" 后再前缀比较
  return cwd != null && `${cwd}/`.startsWith(repoRoot);
}

/**
 * 孤儿进程判定:工作目录已不存在(如已删除 worktree 的残留 dev server)
 * @param pid 进程 id
 * @returns cwd 可读但目录已不存在时为 true
 */
function isStaleOrphan(pid) {
  const cwd = procCwd(pid);
  return cwd != null && !existsSync(cwd);
}

/**
 * 进程是否存活(kill 0 探测,不发信号)
 * @param pid 进程 id
 * @returns 探测成功为 true;进程不存在或无权限为 false
 */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 睡眠等待(用于 SIGTERM 后宽限再 SIGKILL)
 * @param ms 等待毫秒数
 * @returns 到期 resolve 的 Promise
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 停服入口:逐端口终止残留进程(仅限本仓库与孤儿),打印清理摘要 */
async function main() {
  const ports = discoverPorts();
  if (ports.length === 0) {
    console.log("[stop] apps/ 下未发现带 dev 端口的应用");
    return;
  }

  const targets = [];
  for (const { port, name } of ports) {
    for (const pid of listenerPids(port)) {
      if (belongsToRepo(pid)) {
        targets.push({ pid, name, port, reason: "本仓库进程" });
        continue;
      }
      if (isStaleOrphan(pid)) {
        targets.push({ pid, name, port, reason: "孤儿进程(工作目录已删除)" });
        continue;
      }
      console.warn(`[stop] 跳过 ${name}:${port}(pid ${pid},不属于本仓库进程)`);
    }
  }

  if (targets.length === 0) {
    console.log("[stop] 没有需要停止的进程");
    return;
  }

  // 先 SIGTERM 优雅退出,轮询约 2s,仍存活再 SIGKILL
  for (const { pid } of targets) process.kill(pid, "SIGTERM");
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && targets.some((t) => isAlive(t.pid))) {
    await sleep(200);
  }
  for (const target of targets) {
    if (isAlive(target.pid)) process.kill(target.pid, "SIGKILL");
    console.log(`[stop] 已停止 ${target.name}:${target.port}(pid ${target.pid},${target.reason})`);
  }
}

await main();
