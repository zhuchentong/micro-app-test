<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

<!--UI PACKAGES START-->

# @repo/tu-design 组件约定

- **来源分层**：`packages/tu-design/src/components/ui/` 是 tu-design CLI 按 registry 分发的 vendor 区（**禁手改**，升级用 `node scripts/update-ui.mjs`）；自研基础组件放 `packages/tu-design/src/components/app/`（`App` 前缀命名，禁止与上游组件重名）。
- **消费方式**：模板直接写 `<Button>` / `<Card>` / `<Input>` / `<Popover>`（unplugin-vue-components `dirs` 自动导入，来自 `packages/tu-design/src/components`）；或显式 `import { Button } from "@repo/tu-design/button"`。
- **样式纪律**：颜色一律用语义 token（`--app-*` / tu-design 语义变量），禁止字面色值；token 单源在 `@repo/themes`，host 是唯一 CSS 变量写入方（wujie 下变量经继承穿透子应用 DOM）。
- **vendor 区豁免**：`components/ui/**` 被 fmt/lint ignore（保持 registry 原样，保证 `components.lock.json` hash 与 `tu-design diff` 判定准确）。
- **升级流程**：改 `pnpm-workspace.yaml` catalog 版本 → `node scripts/update-ui.mjs` → `pnpm install` → `vp run check --force` + build 回归。

<!--UI PACKAGES END-->
