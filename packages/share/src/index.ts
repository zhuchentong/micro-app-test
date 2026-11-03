/**
 * 主/子应用共享代码统一入口(仅导出稳定层:公共函数 common + 基础组件 ui)。
 * 业务组件不进此入口,按路径引入:`@repo/share/components/Xxx.vue`。
 * 基础组件也可按路径引入:`@repo/share/ui/StatusDot.vue`。
 */
export { formatDuration, formatClockTime } from "./common/format";
