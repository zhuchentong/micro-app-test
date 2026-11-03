import { defineVizeLintConfig, flatConfigs } from "oxlint-plugin-vize";
import { defineConfig } from "@vizejs/vite-plugin/vite-plus";

export default defineConfig({
  staged: {
    // 源码文件走完整 check(格式化 + lint + typecheck)
    "*.{ts,tsx,vue,js,mjs,cjs}": "vp run check -- --fix",
    // 纯配置/文档只格式化:Corsa typecheck 在 staged 无源文件时会误报
    // "No supported source files were selected"(json-only 提交的边界误伤)
    "*.{json,md,css,html,yaml,yml}": "vp run fmt -- --fix",
  },
  fmt: {
    // tu-design vendor 区(components/ui)保持线上 registry 原样:格式化会破坏 components.lock.json
    // 的文件 hash,导致 CLI diff/升级判定失准。自研区(components/app)正常格式化。
    // src/types/generated/、src/styles/generated/ 为构建生成物(dts、tailwind @source 等),
    // 不入库,不参与格式化与 lint
    ignorePatterns: [
      "packages/ui/src/components/ui/**",
      "**/src/types/generated/**",
      "**/src/styles/generated/**",
      // wujie 共享依赖产物(build-shared.mjs 生成,不入库):压缩文件禁格式化与 lint
      "**/public/libs/**",
    ],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    // @repo/share 分层依赖方向:common ← ui ← components,禁止反向/跨层引用
    overrides: [
      {
        files: ["packages/share/src/common/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: ["vue", "@repo/store", "@repo/share/ui", "@repo/share/components"],
              patterns: [
                "vue/*",
                "@repo/store/*",
                "@repo/share/ui/*",
                "@repo/share/components/*",
                "../ui/**",
                "../components/**",
                "**/*.vue",
              ],
            },
          ],
        },
      },
      {
        files: ["packages/share/src/ui/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: ["@repo/store", "@repo/share/components"],
              patterns: ["@repo/store/*", "@repo/share/components/*", "../components/**"],
            },
          ],
        },
      },
    ],
  },
  run: {
    cache: true,
    tasks: {
      // 停止本仓库全部 dev 服务;停服命令绝不可缓存回放,必须 cache:false
      stop: { command: "node scripts/stop.mjs", cache: false },
    },
  },
}).withVue({
  lint: defineVizeLintConfig(...flatConfigs.recommended, ...flatConfigs.ecosystem, {
    ignorePatterns: [
      "dist/**",
      "node_modules/**",
      "packages/ui/src/components/ui/**",
      "**/src/types/generated/**",
      "**/src/styles/generated/**",
      "**/public/libs/**",
    ],
  }),
});
