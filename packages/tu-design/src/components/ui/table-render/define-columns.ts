import type { DataRecord, TableColumnOptions } from "./types";

/**
 * 列定义辅助：补全泛型推导，便于把列配置抽到独立文件。
 *
 * 纯类型辅助，原样返回入参——裸数组同样可直接传给 defineTable（无需此函数）。
 * @param columns - 列配置数组
 * @returns 原样返回的列配置数组
 */
export function defineColumns<T extends DataRecord = DataRecord>(
  columns: TableColumnOptions<T>[],
): TableColumnOptions<T>[] {
  return columns;
}
