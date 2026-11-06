// @repo/tu-design 组件升级脚本:tu-design registry → packages/tu-design 的一条命令同步。
//
// 流程:① tu-design diff 预览线上变化(components.lock.json 三方比对)
//      ② tu-design add --overwrite --no-install --relative-imports [--all | 组件名...]
//        (--all 缺省按 lock 全量;--relative-imports 由 CLI ≥0.5.1 原生把 @/ alias 改写为相对导入;
//         --no-install 跳过 CLI 内置依赖安装 —— workspace:/catalog: 协议不可安装,由 pnpm install 统一处理)
//      ③ 提示 git diff 审查 —— 预期 diff 仅来自上游版本变化
//      ④ 依赖镜像检查:@tu-design/vue manifest ↔ packages/tu-design/package.json
//
// 用法:node scripts/update-ui.mjs [组件名...]   缺省 = --all(components.lock.json 全量)
//      node scripts/update-ui.mjs --tokens-only 仅同步 themes tokens(跳过组件 diff/add)
//      node scripts/update-ui.mjs --post-install 跳过组件 diff/add,重放 tokens + 依赖镜像
//        (pnpm install 后执行:已装 manifest 为新版,tokens/依赖两通道据此精确对齐 —— 见④段)
// 前置:packages/tu-design/components.json 已由 `tu-design init` 生成。

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = join(repoRoot, "packages", "tu-design");

const argv = process.argv.slice(2);
const tokensOnly = argv.includes("--tokens-only");
const postInstall = argv.includes("--post-install");
const names = argv.filter((a) => !a.startsWith("--"));

// ① 预览:diff(失败不阻断,diff 仅信息)
if (!tokensOnly && !postInstall)
  try {
    execFileSync("pnpm", ["dlx", "@tu-design/cli", "diff"], { cwd: uiRoot, stdio: "inherit" });
  } catch {
    console.warn("ℹ diff 预览失败(可能是首次安装,无 lockfile),继续 add");
  }

// ② add:文件写入在前;--no-install 跳过 CLI 内置依赖安装(workspace:/catalog: 协议不可安装),
//    依赖由 pnpm install 统一处理 —— CLI 退出码干净,无需容错
if (!tokensOnly && !postInstall) {
  const addArgs = [
    "dlx",
    "@tu-design/cli",
    "add",
    "--overwrite",
    "--no-install",
    "--relative-imports",
  ];
  if (names.length > 0) addArgs.push(...names);
  else addArgs.push("--all");
  execFileSync("pnpm", addArgs, { cwd: uiRoot, stdio: "inherit" });
}

if (!tokensOnly && !postInstall)
  console.log(`
✔ 完成。请人工审查:
  1. cd packages/tu-design && git diff —— 预期仅上游版本差异(vendor 区已被 fmt/lint ignore,不会被本地工具链改写)
  2. pnpm install(缺失/放宽的依赖已由镜像检查自动写入;⚠ 标注的偏离需人工处理)
  3. node scripts/update-ui.mjs --post-install(install 后重放 tokens + 依赖镜像,拿新版 manifest 精确对齐)
  4. vp run check + vp run build 回归`);

const themesRoot = join(repoRoot, "packages", "themes");

// ===== ④ 依赖镜像:@tu-design/vue manifest ↔ packages/tu-design/package.json =====
// 语义:非 ignore 依赖与上游 range 比对,自动写入仅限「补缺失 + 放宽」;收窄/major/0.x minor
// 不一致只警告。已安装 manifest 可能滞后于本次同步(pnpm install 之前运行时),写入绝不收窄,
// 防止旧 manifest 覆盖人工更新;强制层不变式见 packages/tu-design/src/tests/deps.test.ts。
// ignore 单一来源:packages/tu-design/deps-policy.json(与测试共用,勿各自维护)。
{
  try {
    const require = createRequire(join(themesRoot, "package.json"));
    const upstreamPkg = JSON.parse(
      readFileSync(require.resolve("@tu-design/vue/package.json"), "utf8"),
    );
    const upstreamDeps = upstreamPkg.dependencies ?? {};
    const policyPath = join(uiRoot, "deps-policy.json");
    const ignore = existsSync(policyPath)
      ? Object.keys(JSON.parse(readFileSync(policyPath, "utf8")).ignore ?? {})
      : [];
    const localPkgPath = join(uiRoot, "package.json");
    const localPkg = JSON.parse(readFileSync(localPkgPath, "utf8"));
    const localDeps = localPkg.dependencies ?? {};

    // ^X.Y.Z 专用解析(仓库依赖全为 caret);0.x 的 minor 为破坏性位,跨 minor 视为不可判定
    const parseCaret = (range) => {
      const m = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range ?? "");
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

    const writes = [];
    const issues = [];
    for (const [name, upRange] of Object.entries(upstreamDeps)) {
      if (ignore.includes(name)) continue;
      const ourRange = localDeps[name];
      if (ourRange === undefined) {
        localDeps[name] = upRange;
        writes.push(`补缺失 ${name}@${upRange}`);
        continue;
      }
      if (ourRange === upRange) continue;
      const ours = parseCaret(ourRange);
      const theirs = parseCaret(upRange);
      const comparable =
        ours && theirs && ours[0] === theirs[0] && !(ours[0] === 0 && ours[1] !== theirs[1]);
      if (comparable) {
        if (cmp(ours, theirs) > 0) {
          // 放宽到上游:仅扩大可安装集合,不改 lockfile 解析版本 —— 滞后数据下依然安全
          localDeps[name] = upRange;
          writes.push(`放宽 ${name} ${ourRange} → ${upRange}`);
        } else {
          issues.push(
            `${name}:本地 ${ourRange} 宽于上游 ${upRange},自动收窄已禁用,请人工确认是否跟随上游`,
          );
        }
      } else {
        issues.push(`${name}:版本不可自动判定 本地 ${ourRange} / 上游 ${upRange},请人工对齐`);
      }
    }
    for (const name of Object.keys(localDeps)) {
      if (!(name in upstreamDeps) && !ignore.includes(name)) {
        issues.push(
          `${name}@${localDeps[name]}:上游 manifest 未声明,若确认过期可移除并记入 deps-policy.json`,
        );
      }
    }

    if (writes.length > 0) {
      writeFileSync(localPkgPath, `${JSON.stringify(localPkg, null, 2)}\n`);
      console.log(
        `✔ 依赖镜像写入 packages/tu-design/package.json:${writes.join(";")}\n  请运行 pnpm install`,
      );
    }
    if (issues.length > 0) {
      console.warn(`⚠ 依赖偏离(需人工处理):\n  - ${issues.join("\n  - ")}`);
    }
    if (writes.length === 0 && issues.length === 0) {
      console.log(
        `✔ 依赖镜像一致(@tu-design/vue@${upstreamPkg.version},ignore: ${ignore.join(", ") || "无"})`,
      );
    }
  } catch (error) {
    console.warn(`⚠ 依赖镜像检查跳过:${error.message}`);
  }
}

// ===== tokens 同步:@tu-design/vue registry → packages/themes(独立通道,不走 CLI) =====
// 上游段由本脚本整体替换;===== workspace extensions ===== 之后为本地段,同步时保留。
// hash 记账 packages/themes/tokens.lock.json,与组件 components.lock.json 解耦(tokens 不属 CLI 管辖)。
const VENDORED_BEGIN = `/* ===== @tu-design/vue tokens (vendored, do not edit) ===== */`;
const LOCAL_BEGIN = `/* ===== workspace extensions (同步保留) ===== */`;
const themesTokensPath = join(themesRoot, "src", "tokens.css");
const themesLockPath = join(themesRoot, "tokens.lock.json");

try {
  // 从 themes 的 devDep @tu-design/vue 读取随包发布的 registry(npm 包内含 dist/registry/vue)
  const require = createRequire(join(themesRoot, "package.json"));
  const pkgJsonPath = require.resolve("@tu-design/vue/package.json");
  const upstreamVersion = JSON.parse(readFileSync(pkgJsonPath, "utf8")).version;
  const registryItem = JSON.parse(
    readFileSync(join(dirname(pkgJsonPath), "dist", "registry", "vue", "tokens.json"), "utf8"),
  );
  const file = registryItem.files.find((f) => f.target === "styles/tokens.css");
  if (!file?.content) throw new Error("registry item 未包含 styles/tokens.css content");
  const upstreamCss = file.content;

  // 本地段保留:标记不存在(旧手写 fork)视为空,首次同步完成迁移
  const localSection = existsSync(themesTokensPath)
    ? (readFileSync(themesTokensPath, "utf8").split(LOCAL_BEGIN)[1]?.trimEnd() ?? "")
    : "";
  const nextCss = [VENDORED_BEGIN, upstreamCss, LOCAL_BEGIN, localSection].join("\n");
  // hash 只覆盖 vendor 段且先做空白归一化:fmt(check --fix)会重排 vendor 段空白,
  // 归一化后 hash 仅检测内容漂移(色值/变量名/结构),空白重排不触发 lock 变更
  const nextHash = createHash("sha256").update(upstreamCss.replace(/\s+/g, "")).digest("hex");
  const prevHash = existsSync(themesLockPath)
    ? JSON.parse(readFileSync(themesLockPath, "utf8"))?.files?.["src/tokens.css"]
    : undefined;

  if (prevHash !== nextHash) {
    writeFileSync(themesTokensPath, nextCss);
    writeFileSync(
      themesLockPath,
      `${JSON.stringify(
        { lockfileVersion: 1, version: upstreamVersion, files: { "src/tokens.css": nextHash } },
        null,
        2,
      )}\n`,
    );
    console.log(
      `✔ tokens 已同步 @tu-design/vue@${upstreamVersion} → packages/themes/src/tokens.css`,
    );
  } else {
    // 内容无变化但版本推进(如 patch 升级 tokens 相同):仅刷新 lock 版本字段,
    // 保持「lock.version === 安装包版本」不变式(tokens.test.ts 有断言守卫)
    const lockJson = existsSync(themesLockPath)
      ? JSON.parse(readFileSync(themesLockPath, "utf8"))
      : null;
    if (lockJson && lockJson.version !== upstreamVersion) {
      writeFileSync(
        themesLockPath,
        `${JSON.stringify(
          { lockfileVersion: 1, version: upstreamVersion, files: { "src/tokens.css": nextHash } },
          null,
          2,
        )}\n`,
      );
      console.log(`ℹ tokens 内容无变化,lock 版本更新 → ${upstreamVersion}`);
    } else {
      console.log(`ℹ tokens 无变化(@tu-design/vue@${upstreamVersion})`);
    }
  }
} catch (error) {
  console.warn(`⚠ tokens 同步跳过:${error.message}`);
}
