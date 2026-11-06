// pre-commit staged 检查分流:lint-staged 把匹配文件追加为本脚本参数。
// 1) tu-design vendor 区(components/ui)是 registry 原样区,不参与任何处理
//    (与 vite.config.ts fmt/lint ignorePatterns 豁免一致);
// 2) 其余源码文件跑 fmt + lint(含 type-aware 规则)。不跑完整 `vp check`:
//    其 Corsa typecheck 在文件参数模式下会把 vendor 文件经依赖闭包拉进诊断,
//    导致 tu-design 升级提交被上游组件的本地严格诊断拦截;完整 typecheck
//    由 `vp run ready`(无参数 vp check,尊重 lint.ignorePatterns)把守。
import { spawnSync } from "node:child_process";

const VENDOR = "packages/tu-design/src/components/ui/";
const files = process.argv.slice(2);
const rest = files.filter((f) => !f.replaceAll("\\", "/").includes(VENDOR));

if (rest.length === 0) process.exit(0);

for (const args of [
  ["vp", "run", "fmt", "--", "--fix", ...rest],
  ["vp", "lint", "--fix", ...rest],
]) {
  const { status } = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}
