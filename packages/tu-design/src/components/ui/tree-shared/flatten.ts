/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：无实质改动。
 */
import type { Key, TreeNode } from "./interface";

/**
 * 按展开状态把节点树拍平为一维列表：group 节点总是下钻；普通节点仅在
 * 未提供 expandedKeys 或其 key 在展开集合内时下钻；ignored 节点不下钻。
 * @param treeNodes - 待拍平的节点树
 * @param expandedKeys - 已展开节点的 key 列表；缺省视为全部展开
 * @returns 深度优先顺序的一维节点列表
 */
export function flatten<R, G, I>(
  treeNodes: Array<TreeNode<R, G, I>>,
  expandedKeys?: Key[],
): Array<TreeNode<R, G, I>> {
  const expandedKeySet = expandedKeys ? new Set<Key>(expandedKeys) : undefined;
  const flattenedNodes: Array<TreeNode<R, G, I>> = [];
  /**
   * 深度优先收集当前层节点并按展开状态决定是否下钻。
   * @param treeNodes - 当前层的节点列表
   * @returns 无返回值
   */
  function traverse(treeNodes: Array<TreeNode<R, G, I>>): void {
    treeNodes.forEach((treeNode) => {
      flattenedNodes.push(treeNode);
      if (treeNode.isLeaf || !treeNode.children || treeNode.ignored) return;
      if (treeNode.isGroup) {
        // group node shouldn't be expanded
        traverse(treeNode.children);
      } else if (
        // normal non-leaf node
        expandedKeySet === undefined ||
        expandedKeySet.has(treeNode.key)
      ) {
        traverse(treeNode.children);
      }
    });
  }
  traverse(treeNodes);
  return flattenedNodes;
}
