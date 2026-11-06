export interface SelectItemOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/**
 * 将字符串简写归一为完整选项对象：字符串同时作为 label 与 value。
 * @param item - 字符串简写或完整选项对象
 * @returns 归一后的选项对象（字符串入参转为 label/value 同值的选项）
 */
export function normalizeSelectItem(item: string | SelectItemOption): SelectItemOption {
  return typeof item === "string" ? { label: item, value: item } : item;
}
