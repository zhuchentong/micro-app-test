# @repo/themes — 主题 token 单源

- **`src/tokens.css` 是双段生成的文件，不要按普通源文件对待**：
  - vendor 段（`/* ===== @tu-design/vue tokens (vendored, do not edit) ===== */` 起，src/tokens.css:1）：来自上游 `@tu-design/vue` registry（包内 `dist/registry/vue/tokens.json`），**禁手改**；
  - 本地段（`/* ===== workspace extensions (同步保留) ===== */` 之后，src/tokens.css:144）：**唯一可编辑区**，同步时自动保留。
- **同步/升级上游 tokens**：`node scripts/update-ui.mjs --tokens-only`——脚本整体替换 vendor 段、重写 `tokens.lock.json`、保留本地段（scripts/update-ui.mjs:148-212；不加 `--tokens-only` 则连带同步 tu-design 组件）。
- `tokens.lock.json` 只 hash **vendor 段**（空白归一化后 sha256，`src/tokens.css` 键）：手改本地段**不会**触发任何测试；vendor 段漂移与上游版本不一致由 `tokens.test.ts:124-141` 两个测试检出。
- data 图表色 `--app-data-1..8` 规范：按序号固定取用，明暗两套同值，必须为 6 位 hex（tokens.test.ts:143-149）。
- token 单源地位与"host 是唯一 CSS 变量写入方"见根 AGENTS.md（UI PACKAGES 块），此处不重复。
