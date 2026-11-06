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
- **依赖镜像**：`packages/tu-design/package.json` 的 dependencies 是 `@tu-design/vue` manifest 的镜像（跟随上游声明），**豁免「新增依赖先进 catalog」约定**；有意偏离记入 `packages/tu-design/deps-policy.json`（`update-ui.mjs` 镜像段与 `deps.test.ts` 共用，勿各自维护）。
- **升级流程**：改 `pnpm-workspace.yaml` catalog 版本 → `node scripts/update-ui.mjs` → `pnpm install` → `node scripts/update-ui.mjs --post-install`（install 后重放 tokens + 依赖镜像，拿新版 manifest 精确对齐）→ `vp run check` + build 回归。

<!--UI PACKAGES END-->

# 仓库结构与端口

- wujie 微前端 monorepo（pnpm + Vite+）。apps：`micro-host`（宿主,5175）、`micro-app-a`(7201)、`micro-app-b`(7202)、`micro-auth`(7203)、`micro-app-demo`(7204)；端口全部为 vite.config.ts 里的 `server.port` 字面量 + `strictPort`（`scripts/stop.mjs`、`dev.mjs` 靠字面量发现端口，不支持变量拼装）。
- packages：`wujie-kit`（wujie 事件/生命周期契约）、`store`（共享 pinia `defineStore` 定义）、`share`（分层公共库）、`themes`（token 单源）、`tu-design`、`config-{lint,typescript,vite}`。
- 依赖版本统一走 `pnpm-workspace.yaml` catalog（`catalogMode: prefer`）：新增依赖先进 catalog，包内用 `catalog:` 引用。

# 常用命令

- 全量验证：`vp run ready`（= `vp check` + 全仓 test + build）。
- dev：`vp run dev` 为交互启动器（非 TTY 时全启；先子应用后 host）。直达模式 `node scripts/dev.mjs micro-app-a`（名字含宿主即自动带宿主）、`--all`、`--host`。dev 启动前有端口预检，会先 stop 本仓库残留进程——与手动 dev 并行互杀属预期。
- 停全部 dev 服务：`vp run stop`（仅 Linux；按 /proc cwd 护栏只杀本仓库进程）。
- 测试：包目录内 `vp test`；全仓 `vp run -r test`。
- E2E smoke：`vp run e2e`，前提全局安装 agent-browser（>=0.39）；子应用区域必须用 eval JS click（wujie iframe 覆盖导致原生 click 被拒），等待用 `wait --text/--fn` 不用固定 sleep（详见 `scripts/e2e.mjs` 头注释）。

# 构建（顺序敏感）

- 每个 app 的 build = `node scripts/build-shared.mjs && vp build`：先经 host 包的依赖把 vue/pinia/vue-router 打成 IIFE 共享包（`window.__MICRO_SHARED__`），产物 `public/generated/shared-deps.js` 不入库。**不要直接 `vp build` 跳过这一步**；该脚本独立解析依赖，禁止复用 `@repo/config-vite` 的 defineAppConfig（会把共享依赖 external 掉）。
- fmt/lint ignore 的生成/产物区：`**/src/types/generated/**`、`**/src/styles/generated/**`、`**/public/libs/**`、`packages/tu-design/src/components/ui/**`。

# 架构约束（lint 强制，配置在根 vite.config.ts）

- `@repo/share` 分层依赖：`common ← ui ← components`，禁止反向/跨层引用；`common` 还禁止 import vue、`@repo/store`、任何 `.vue`（`no-restricted-imports` override）。
- store 同步契约：host 是状态权威源（`host:state` 全量广播 + `rev` 判重 + `sub:state-request` 握手，契约类型在 `packages/wujie-kit`，同步器在 `packages/store`）。机制详见 README「Store 同步」；**新增需同步 store 的必改清单见 `packages/store/AGENTS.md`**。
- staged 钩子分流：源码文件经 `scripts/staged-check.mjs` 过滤 vendor 区后走 fmt + lint（不跑完整 `vp check`：Corsa typecheck 文件参数模式会把 vendor 经依赖闭包拉进诊断）；纯 json/md/css/yaml 只 `vp run fmt -- --fix`；完整 typecheck 由 `vp run ready`（无参数 `vp check`，尊重 `lint.ignorePatterns`）把守。tu-design `components/ui/**` 是 registry vendor 区，不参与 check/fmt，避免升级被本地类型诊断拦截。
- `stop` 任务必须 `cache: false`（停服命令绝不可缓存回放）；新增同类任务同理。
