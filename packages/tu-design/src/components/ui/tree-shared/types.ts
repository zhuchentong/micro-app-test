import type { Key } from "./interface";

/** 组件公开的选项类型：key/label/children 常用字段显式化，其余字段透传（对齐 naive-ui TreeOption） */
export interface TreeOption {
  key: Key;
  label?: string;
  children?: TreeOption[];
  disabled?: boolean;
  isLeaf?: boolean;
  [key: string]: unknown;
}
