import { useTableRender } from "./useTableRender";
import type { DataRecord, DefineTableOptions, TableRenderDefinition } from "./types";

/**
 * 聚合入口：单次调用完成「列定义 + 数据内核 + 分页排序状态 + 实例动作」。
 *
 * 返回值直接传给 `<TableRender :definition="def" />`；
 * 须在组件 setup 中调用（TanStack useVueTable 约束）。
 * @param config - 表格配置：列定义、数据源（静态 data 或服务端 onLoad）、分页排序、行选择等
 * @returns 表格渲染定义，直接传给 TableRender 组件的 definition prop
 */
export function defineTable<T extends DataRecord>(
  config: DefineTableOptions<T>,
): TableRenderDefinition<T> {
  return useTableRender<T>(config);
}
