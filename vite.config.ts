import { defineVizeLintConfig, flatConfigs } from "oxlint-plugin-vize";
import { defineConfig } from "@vizejs/vite-plugin/vite-plus";

export default defineConfig({
  staged: {
    "*": "vp run check -- --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
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
    ignorePatterns: ["dist/**", "node_modules/**"],
  }),
});
