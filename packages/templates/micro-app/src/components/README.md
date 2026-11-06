# components/

子应用本地业务组件目录(占位文件,保证脚手架拷贝时目录结构完整)。

- 仅放本应用私有的业务组件;跨主/子应用复用的组件一律上浮 `@repo/share`
  (分层方向:`common ← composables ← ui ← components`,lint 由根 vite.config.ts 强制)。
- 跨应用复用的组合式函数同样上浮 `@repo/share/composables`。
