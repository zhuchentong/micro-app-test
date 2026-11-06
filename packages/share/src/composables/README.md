# composables/

跨主/子应用共享的组合式函数层(依赖 vue reactivity 的公共 hooks)。

- 分层方向:`common ← composables ← ui ← components`——本层可依赖 vue、vue-router、
  `@repo/store`、`common`;禁止 import `.vue` 与 ui/components 层(lint 由根 vite.config.ts
  `no-restricted-imports` override 强制)。
- 命名:文件 `use-<x>.ts`,导出 `use<X>`;实现后经 `src/index.ts` 导出(或按路径
  `@repo/share/composables/use-xxx` 引入)。
- 包内测试为纯 TS 环境(vitest 无 vue 插件):组合函数测试直连具体模块,禁止经
  `src/index.ts` 连带解析 `.vue` 链路。
