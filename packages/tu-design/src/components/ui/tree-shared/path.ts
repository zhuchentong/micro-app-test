/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：无实质改动。
 */
import type { GetPathOptions, Key, MergedPath, TreeMate, TreeNode } from "./interface";

/**
 * 计算指定节点的路径信息：从目标节点沿父链上溯收集并反转，得到根到该节点的
 * keyPath 与 treeNodePath；ignored 节点返回空路径且 treeNode 为 null。
 * @param key - 目标节点 key；null/undefined 时返回空路径
 * @param root0 - 路径选项
 * @param root0.includeGroup - 是否在路径中包含 group 节点
 * @param root0.includeSelf - 是否在路径中包含自身节点
 * @param treeMate - 树 mate 实例，提供节点映射查询
 * @returns 合并后的路径对象（keyPath、treeNodePath 与 treeNode）
 */
export function getPath<R, G, I, T extends boolean>(
  key: Key | null | undefined,
  { includeGroup = false as any, includeSelf = true }: GetPathOptions<T>,
  treeMate: TreeMate<R, G, I>,
): T extends true ? MergedPath<R, G> : MergedPath<R, R> {
  const treeNodeMap = treeMate.treeNodeMap;
  let treeNode = key === null || key === undefined ? null : (treeNodeMap.get(key) ?? null);
  const mergedPath: MergedPath<R, G> = {
    keyPath: [],
    treeNodePath: [],
    treeNode: treeNode as unknown as TreeNode<R, G> | null,
  };
  if (treeNode?.ignored) {
    mergedPath.treeNode = null;
    return mergedPath as any;
  }
  while (treeNode) {
    if (!treeNode.ignored && (includeGroup || !treeNode.isGroup)) {
      mergedPath.treeNodePath.push(treeNode as any);
    }
    treeNode = treeNode.parent as any;
  }
  mergedPath.treeNodePath.reverse();
  if (!includeSelf) mergedPath.treeNodePath.pop();
  mergedPath.keyPath = mergedPath.treeNodePath.map((treeNode) => treeNode.key);
  return mergedPath as any;
}
