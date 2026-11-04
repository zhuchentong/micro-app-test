/**
 * 主/子应用共享代码统一入口:公共函数(common)+ ui 组件全量导出。
 * 业务组件不进此入口,按路径引入:`@repo/share/components/Xxx.vue`。
 *
 * ⚠️ share 包内测试纪律:本包测试环境为纯 TS(vitest 无 vue 插件),
 * 包内测试文件禁止经本入口 import(会连带解析 .vue 链路而失败),
 * 必须直连具体模块(如 `./format`);组件测试需另行配置 vue 测试环境。
 * 消费方(host/子应用)环境含 vue 插件,不受此限制。
 */
export { formatDuration, formatClockTime } from "./common/format";
export { default as StatusDot } from "./ui/StatusDot.vue";
export { default as EmptyBlock } from "./ui/EmptyBlock.vue";
export { PageContainer, DefaultLayout, TableLayout, FormLayout } from "./ui/PageContainer";
