#!/usr/bin/env node
/**
 * 停止本仓库的全部 dev 服务(vp run stop)。
 *
 * 查找占用下列端口的进程并终止:
 * - 5175 host(来源:apps/host/vite.config.ts,strictPort:true)
 * - 7201 sub-app-a(来源:apps/sub-app-a/vite.config.ts)
 * - 7202 sub-app-b(来源:apps/sub-app-b/vite.config.ts)
 *
 * 安全护栏:仅终止工作目录位于本仓库内的进程(Linux /proc/<pid>/cwd),
 * 端口被无关进程占用时跳过并告警。仅支持 Linux。
 */
import { spawnSync } from "node:child_process";
import { readlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 端口清单:新增子应用时在此登记(与各 vite.config.ts 保持一致) */
const ports = [
  { port: 5175, name: "host" },
  { port: 7201, name: "sub-app-a" },
  { port: 7202, name: "sub-app-b" },
];

/** 仓库根目录(脚本位于 <root>/scripts/) */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** 查询端口上的监听进程 pid 集合 */
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

/** 进程工作目录是否在本仓库内(防止误杀无关进程) */
function belongsToRepo(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`).startsWith(repoRoot);
  } catch {
    return false; // 进程已退出或无权限
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const targets = [];
  for (const { port, name } of ports) {
    for (const pid of listenerPids(port)) {
      if (!belongsToRepo(pid)) {
        console.warn(`[stop] 跳过 ${name}:${port}(pid ${pid},不属于本仓库进程)`);
        continue;
      }
      targets.push({ pid, name, port });
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
    console.log(`[stop] 已停止 ${target.name}:${target.port}(pid ${target.pid})`);
  }
}

await main();
