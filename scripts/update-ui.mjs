// @repo/ui 组件升级脚本:tu-design registry → packages/ui 的一条命令同步。
//
// 流程:① tu-design diff 预览线上变化(components.lock.json 三方比对)
//      ② tu-design add --overwrite 覆盖为线上最新(组件源码归 registry 管,本地不手改)
//      ③ 别名改写:CLI 产出的 `@/...` 导入转为本包相对导入(类型检查器不解析包自引用)
//      ④ 提示 git diff 审查 —— 预期 diff 仅来自上游版本变化
//
// 用法:node scripts/update-ui.mjs [组件名...]   缺省 = components.lock.json 记录的全部组件
// 前置:packages/ui/components.json 已由 `tu-design init` 生成;版本升级同时改 pnpm-workspace.yaml catalog。

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = join(repoRoot, "packages", "ui");
const srcRoot = join(uiRoot, "src");
const cli = ["pnpm", "dlx", "@tu-design/cli"];

// ① 预览:dry-run + diff(失败不阻断,diff 仅信息)
try {
  execFileSync(cli[0], [...cli.slice(1), "diff"], { cwd: uiRoot, stdio: "inherit" });
} catch {
  console.warn("ℹ diff 预览失败(可能是首次安装,无 lockfile),继续 add");
}

// ② 确定组件集:入参优先,否则 lockfile 全量
const lock = JSON.parse(readFileSync(join(uiRoot, "components.lock.json"), "utf8"));
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(lock.packages);
console.log(`ℹ 升级组件:${names.join(" ")}`);

// add --overwrite:文件写入在前,CLI 的依赖安装步骤因 workspace:/catalog: 协议会经 npm 失败 ——
// 属预期噪音,依赖由 pnpm install 统一处理,忽略此步退出码
try {
  execFileSync(cli[0], [...cli.slice(1), "add", "--overwrite", ...names], {
    cwd: uiRoot,
    stdio: "inherit",
  });
} catch {
  console.warn(
    "ℹ CLI 内置依赖安装失败为预期(workspace:/catalog: 协议 npm 不识别),依赖由 pnpm install 处理",
  );
}

// ③ 相对导入改写:registry 产出 `@/X`(aliasRoot=src,两层 components/ui/<name>/ 同构)
//    → `@/lib/utils` = `../../../lib/utils`;`@/components/ui/X` = `../X`
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(vue|ts)$/.test(e.name) ? [p] : [];
  });

let rewritten = 0;
for (const file of walk(srcRoot)) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replaceAll(`from "@/lib/utils"`, `from "../../../lib/utils"`)
    .replaceAll(`from "@/components/ui/`, `from "../`);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`✔ 改写 ${relative(srcRoot, file)}`);
    rewritten++;
  }
}
console.log(`ℹ 别名改写:${rewritten} 个文件`);

console.log(`
✔ 完成。请人工审查:
  1. cd packages/ui && git diff —— 预期仅上游版本差异(vendor 区已被 fmt/lint ignore,不会被本地工具链改写)
  2. pnpm install(若 registry 声明了新依赖,手动补进 packages/ui/package.json 后安装)
  3. vp run check --force + vp run build 回归`);
