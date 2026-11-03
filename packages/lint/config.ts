/*
 * @repo/lint 配置片段：jsdoc lint 的单一来源。
 *（包名以 @ 开头，不能写进 JSDoc 块——check-tag-names 会将其误判为 tag）
 *
 * 消费方（root vite.config.ts）通过 withJsdoc 将本片段键级合并进既有 lint 块，
 * 严禁整体 spread——浅覆盖会丢失 base 的 rules/overrides（如 share 分层依赖规则）。
 *
 * 合并语义（base 优先）：
 * - plugins：去重追加内置插件（jsdoc）
 * - rules：键合并，同名键以 base 为准
 * - settings：二层深合并（jsdoc 子键）
 * - overrides：base 之后尾部追加（豁免规则优先生效）
 * - jsPlugins 与其余键：原样保留（插件注册项单独导入，避免数组去重逻辑）
 */

/** oxlint 内置 jsdoc 插件（无需新增依赖，oxlint 1.88 原生支持） */
export const jsdocPlugins = ["jsdoc"] as const;

/**
 * jsdoc 结构规则集。
 *
 * 取舍说明（TS 项目惯例）：
 * - 不启用 `require-param-type` / `require-returns-type`：TS 签名已有类型，JSDoc 重复标注纯冗余
 * - 不启用 `require-throws-*` / `require-property*`：throw 断言误报多、typedef 场景本项目未使用
 * - `require-param` / `require-param-description` / `require-returns` 为核心完整性校验
 */
export const jsdocRules = {
  "jsdoc/require-param": "error",
  "jsdoc/require-param-description": "error",
  "jsdoc/require-param-name": "error",
  "jsdoc/require-returns": "error",
  "jsdoc/require-returns-description": "error",
  "jsdoc/require-yields": "error",
  "jsdoc/check-tag-names": "error",
  "jsdoc/check-access": "error",
  "jsdoc/check-property-names": "error",
  "jsdoc/empty-tags": "error",
  "jsdoc/no-blank-blocks": "error",
  "jsdoc/implements-on-classes": "error",
  "jsdoc/no-defaults": "error",
  "repo-lint/require-jsdoc": "error",
} as const;

/** jsdoc 插件 settings：项目既有 `@internal` 用法（如 tabs.ts）不因规则启用而误伤 */
export const jsdocSettings = {
  jsdoc: { ignoreInternal: true, ignorePrivate: true },
} as const;

/** 自定义插件注册项（specifier 形式，与 `vite-plus/oxlint-plugin` 同构） */
export const repoJsdocPlugin = {
  name: "repo-lint",
  specifier: "@repo/lint/jsdoc-plugin",
} as const;

/**
 * require-jsdoc 豁免清单（overrides，追加到 base 之后）：
 * - 测试文件：测试名即文档；`require-*` 结构规则（@param/@returns 完整性）一并关闭
 *   ——测试内的 mock 工厂注释是行内说明而非 API 文档；保留 check-* 轻量拼写规范
 * - `.vue`：`<script setup>` 顶层绑定是组件内部实现而非模块 API；结构规则
 *   （require-param 等）对 `.vue` 仍生效（已实测），仅关闭强制 JSDoc
 * - `packages/lint/**`：规则自举（dogfooding）豁免，规则稳定 1~2 个迭代后移除
 */
export const jsdocExemptOverrides: Array<{
  files: string[];
  rules: Record<string, LintRuleValue>;
}> = [
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/tests/**"],
    rules: {
      "repo-lint/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-param-name": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/require-yields": "off",
    },
  },
  {
    files: ["**/*.vue"],
    rules: { "repo-lint/require-jsdoc": "off" },
  },
  {
    files: ["packages/lint/**"],
    rules: { "repo-lint/require-jsdoc": "off" },
  },
];

/** lint 规则严重级别（与 Oxlint 的字符串 severity 对齐，用于保留调用处字面量推断） */
type LintSeverity = "error" | "warn" | "off";

/** 规则值：severity 或带选项的元组（如 `no-restricted-imports` 的 `["error", {...}]`） */
type LintRuleValue = LintSeverity | [LintSeverity, ...unknown[]];

/** lint 块的最小结构约束（仅约束 withJsdoc 需要合并的键，其余键经泛型透传保留） */
interface LintBlockLike {
  plugins?: readonly string[];
  rules?: Record<string, LintRuleValue>;
  settings?: Record<string, Record<string, unknown>>;
  overrides?: Array<{ files?: string[]; rules?: Record<string, LintRuleValue> }>;
  [key: string]: unknown;
}

/**
 * 将 jsdoc 配置片段键级合并进既有 lint 块（base 同名键优先，绝不覆盖）。
 *
 * @template T 传入 lint 块的类型（保留全部自有键的静态信息）
 * @param {T} base 既有 lint 块（root lint 块或 withVue 的 VizeLintConfigFragment）
 * @returns {T} 合并后的 lint 块（类型与入参一致，可原位替换 `lint: {...}`）
 */
export function withJsdoc<T extends LintBlockLike>(base: T): T {
  const baseSettings = (base.settings ?? {}) as Record<string, Record<string, unknown>>;
  // 键级合并后整体断言回 T:合并仅影响四个已知键,其余键经 ...base 原样透传
  return {
    ...base,
    plugins: [...new Set([...(base.plugins ?? []), ...jsdocPlugins])],
    rules: { ...jsdocRules, ...(base.rules ?? {}) },
    settings: {
      ...baseSettings,
      jsdoc: { ...jsdocSettings.jsdoc, ...baseSettings.jsdoc },
    },
    overrides: [...(base.overrides ?? []), ...jsdocExemptOverrides],
  } as T;
}
