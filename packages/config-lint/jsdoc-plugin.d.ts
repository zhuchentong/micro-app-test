/**
 * jsdoc-plugin.js 的类型声明（JS 源文件，oxlint jsPlugins 加载器消费）。
 * 直接复用 `vite-plus/lint/plugins` 的 Plugin 类型（re-export 自 @oxlint/plugins）。
 */
declare const plugin: import("vite-plus/lint/plugins").Plugin;
export default plugin;
