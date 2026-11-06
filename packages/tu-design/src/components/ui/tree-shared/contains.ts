/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：无实质改动。
 */
import type { TreeNode } from "./interface";

/**
 * 判断 child 是否为 parent 的后代（含自身），沿父链逐级上溯比对 key。
 * @param parent - 祖先节点
 * @param child - 待判定的节点，可为 null 或 undefined
 * @returns child 位于 parent 子树内（含相等）时返回 true
 */
export function contains<R, G, I>(
  parent: TreeNode<R, G, I>,
  child: TreeNode<R, G, I> | null | undefined,
): boolean {
  const parentKey = parent.key;
  while (child) {
    if (child.key === parentKey) return true;
    child = child.parent as any;
  }
  return false;
}
