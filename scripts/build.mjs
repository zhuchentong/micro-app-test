#!/usr/bin/env node
/**
 * 构建 apps/* 下的应用(vp run build)。
 *
 * 用法:
 *   node scripts/build.mjs                 # 构建全部应用
 *   node scripts/build.mjs sub-app-a       # 只构建指定应用(可传多个)
 *
 * 特性:
 * - 自动发现:apps/<dir>/package.json 含 build 脚本即纳入,新增应用零改动
 * - 串行构建,任一失败立即中止并以非零码退出(CI 依赖此语义)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 仓库根目录(脚本位于 <root>/scripts/) */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const appsDir = join(repoRoot, "apps");

/** 发现 apps/* 下带 build 脚本的应用目录名(按名称排序,保证顺序稳定) */
function discoverApps() {
  const names = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(appsDir, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.build) names.push(entry.name);
    } catch {
      console.warn(`[build] 跳过 ${entry.name}:package.json 解析失败`);
    }
  }
  return names.sort();
}

function main() {
  const available = discoverApps();
  if (available.length === 0) {
    console.error("[build] apps/ 下未发现带 build 脚本的应用");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const unsupported = args.filter((arg) => arg.startsWith("-"));
  if (unsupported.length > 0) {
    console.error(`[build] 不支持的选项:${unsupported.join(", ")}`);
    process.exit(1);
  }

  let targets = available;
  if (args.length > 0) {
    const unknown = args.filter((name) => !available.includes(name));
    if (unknown.length > 0) {
      console.error(`[build] 未知应用:${unknown.join(", ")}(可用:${available.join(", ")})`);
      process.exit(1);
    }
    targets = [...new Set(args)]; // 去重,保持命令行给定顺序
  }

  for (const name of targets) {
    console.log(`[build] ▶ ${name} 开始构建`);
    const started = Date.now();
    const result = spawnSync("vp", ["-C", join("apps", name), "build"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (result.error) {
      console.error(`[build] ✗ ${name} 启动失败:${result.error.message}`);
      process.exit(1);
    }
    if (result.status !== 0) {
      console.error(`[build] ✗ ${name} 构建失败(exit ${result.status},耗时 ${seconds}s)`);
      process.exit(result.status ?? 1);
    }
    console.log(`[build] ✓ ${name} 构建完成(耗时 ${seconds}s)`);
  }
  console.log(`[build] 全部完成,共 ${targets.length} 个应用`);
}

main();
