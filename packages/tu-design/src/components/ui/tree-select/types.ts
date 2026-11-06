import type { Key } from "../tree-shared";

/** 触发器多选标签的展示结构（由选中 key 经 treeMate.getNode 解析，失效 key 静默剔除） */
export interface TreeSelectTag {
  key: Key;
  label: string;
}
