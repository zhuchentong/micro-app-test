/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：无实质改动。
 */
import type { Key, TreeMate, MergedKeys, TreeNode } from "./interface";
import { isExpilicitlyNotLoaded, merge, minus, traverseWithCb, TRAVERSE_COMMAND } from "./utils";

export class SubtreeNotLoadedError extends Error {
  constructor() {
    super();
    this.message =
      "SubtreeNotLoadedError: checking a subtree whose required nodes are not fully loaded.";
  }
}

/**
 * 计算勾选后的完整选中 key 集合：把新增勾选并入当前选中集，再级联扩展到子孙节点。
 * @param checkKeys - 本次新增勾选的节点 key 列表
 * @param currentCheckedKeys - 当前已选中的 key 列表
 * @param treeMate - 树 mate 实例，用于查询节点与子树
 * @returns 扩展后的选中 key 集合
 */
function getExtendedCheckedKeySetAfterCheck<R, G, I>(
  checkKeys: Key[],
  currentCheckedKeys: Key[],
  treeMate: TreeMate<R, G, I>,
): Set<Key> {
  return getExtendedCheckedKeySet(currentCheckedKeys.concat(checkKeys), treeMate);
}

/**
 * 收集取消勾选节点的可用祖先 key 集合（级联反选时这些祖先需同步取消勾选）；
 * 上溯在遇到 disabled 节点或已访问节点时截断。
 * @param uncheckedKeys - 被取消勾选的节点 key 列表
 * @param treeMate - 树 mate 实例，用于查询节点父子关系
 * @returns 需要联动取消勾选的祖先 key 集合
 */
function getAvailableAscendantNodeSet<R, G, I>(
  uncheckedKeys: Key[],
  treeMate: TreeMate<R, G, I>,
): Set<Key> {
  const visitedKeys: Set<Key> = new Set();
  uncheckedKeys.forEach((uncheckedKey) => {
    const uncheckedTreeNode = treeMate.treeNodeMap.get(uncheckedKey);
    if (uncheckedTreeNode !== undefined) {
      let nodeCursor = uncheckedTreeNode.parent;
      while (nodeCursor !== null) {
        if (nodeCursor.disabled) break;
        if (visitedKeys.has(nodeCursor.key)) break;
        else {
          visitedKeys.add(nodeCursor.key);
        }
        nodeCursor = nodeCursor.parent;
      }
    }
  });
  return visitedKeys;
}

/**
 * 计算取消勾选后的完整选中 key 集合：从扩展选中集移除被取消的 key
 * 及其可用祖先，返回剩余集合。
 * @param uncheckedKeys - 本次取消勾选的节点 key 列表
 * @param currentCheckedKeys - 当前已选中的 key 列表
 * @param treeMate - 树 mate 实例
 * @returns 取消勾选后剩余的选中 key 集合
 */
function getExtendedCheckedKeySetAfterUncheck<R, G, I>(
  uncheckedKeys: Key[],
  currentCheckedKeys: Key[],
  treeMate: TreeMate<R, G, I>,
): Set<Key> {
  const extendedCheckedKeySet = getExtendedCheckedKeySet(currentCheckedKeys, treeMate);
  const extendedKeySetToUncheck = getExtendedCheckedKeySet(uncheckedKeys, treeMate, true);
  const ascendantKeySet: Set<Key> = getAvailableAscendantNodeSet(uncheckedKeys, treeMate);
  const keysToRemove: Key[] = [];
  extendedCheckedKeySet.forEach((key) => {
    if (extendedKeySetToUncheck.has(key) || ascendantKeySet.has(key)) {
      keysToRemove.push(key);
    }
  });
  keysToRemove.forEach((key) => extendedCheckedKeySet.delete(key));
  return extendedCheckedKeySet;
}

/**
 * 计算树勾选结果：cascade=false 时直接在现有选中集上增删；
 * cascade=true 时先扩展选中集，再自底向上按层归并出最终勾选状态
 * （checkStrategy 为 all/parent/child 时分别保留全部/父节点/叶子选中）。
 * @param options - 勾选参数：当前选中与半选 key、本次勾选/取消的 key、
 *   cascade、leafOnly 与 checkStrategy
 * @param treeMate - 树 mate 实例，提供层级节点表用于自底向上归并
 * @returns 最终的选中 key 列表与半选 key 列表
 */
export function getCheckedKeys<R, G, I>(
  options: {
    checkedKeys: Key[];
    indeterminateKeys: Key[];
    keysToCheck?: Key[];
    keysToUncheck?: Key[];
    cascade: boolean;
    leafOnly: boolean;
    checkStrategy: string;
  },
  treeMate: TreeMate<R, G, I>,
): MergedKeys {
  const {
    checkedKeys,
    keysToCheck,
    keysToUncheck,
    indeterminateKeys,
    cascade,
    leafOnly,
    checkStrategy,
  } = options;
  if (!cascade) {
    if (keysToCheck !== undefined) {
      return {
        checkedKeys: merge(checkedKeys, keysToCheck),
        indeterminateKeys: Array.from(indeterminateKeys),
      };
    } else if (keysToUncheck !== undefined) {
      return {
        checkedKeys: minus(checkedKeys, keysToUncheck),
        indeterminateKeys: Array.from(indeterminateKeys),
      };
    } else {
      return {
        checkedKeys: Array.from(checkedKeys),
        indeterminateKeys: Array.from(indeterminateKeys),
      };
    }
  }
  const { levelTreeNodeMap } = treeMate;
  let extendedCheckedKeySet: Set<Key>;
  if (keysToUncheck !== undefined) {
    extendedCheckedKeySet = getExtendedCheckedKeySetAfterUncheck(
      keysToUncheck,
      checkedKeys,
      treeMate,
    );
  } else if (keysToCheck !== undefined) {
    extendedCheckedKeySet = getExtendedCheckedKeySetAfterCheck(keysToCheck, checkedKeys, treeMate);
  } else {
    extendedCheckedKeySet = getExtendedCheckedKeySet(checkedKeys, treeMate);
  }

  const checkStrategyIsParent = checkStrategy === "parent";
  const checkStrategyIsChild = checkStrategy === "child" || leafOnly;

  const syntheticCheckedKeySet: Set<Key> = extendedCheckedKeySet;
  const syntheticIndeterminateKeySet: Set<Key> = new Set();
  const maxLevel = Math.max.apply(null, Array.from(levelTreeNodeMap.keys()));
  // cascade check
  // 1. if tree is fully loaded, it just works
  // 2. if the tree is not fully loaded, we assume that keys which is in not
  //    loaded tree are not in checked keys
  //    for example:
  //    a -- b(fully-loaded)   -- c(fully-loaded)
  //      |- d(partial-loaded) -- ?e(not-loaded)
  //    in the case, `e` is assumed not to be checked, nor we can't calc `d`'s
  //    and `a`'s status
  for (let level = maxLevel; level >= 0; level -= 1) {
    const levelIsZero = level === 0;
    // it should exists, nor it is a bug
    const levelTreeNodes = levelTreeNodeMap.get(level);
    for (const levelTreeNode of levelTreeNodes as Array<TreeNode<R, G, I>>) {
      if (levelTreeNode.isLeaf) continue;
      const { key: levelTreeNodeKey, shallowLoaded } = levelTreeNode;
      if (checkStrategyIsChild && shallowLoaded) {
        levelTreeNode.children!.forEach((v) => {
          if (!v.disabled && !v.isLeaf && v.shallowLoaded && syntheticCheckedKeySet.has(v.key)) {
            syntheticCheckedKeySet.delete(v.key);
          }
        });
      }
      if (levelTreeNode.disabled || !shallowLoaded) {
        continue;
      }
      let fullyChecked = true;
      let partialChecked = false;
      let allDisabled = true;
      // it is shallow loaded, so `children` must exist
      for (const childNode of levelTreeNode.children as Array<TreeNode<R, G, I>>) {
        const childKey = childNode.key;
        if (childNode.disabled) continue;
        if (allDisabled) allDisabled = false;
        if (syntheticCheckedKeySet.has(childKey)) {
          partialChecked = true;
        } else if (syntheticIndeterminateKeySet.has(childKey)) {
          partialChecked = true;
          fullyChecked = false;
          break;
        } else {
          fullyChecked = false;
          if (partialChecked) {
            break;
          }
        }
      }
      if (fullyChecked && !allDisabled) {
        if (checkStrategyIsParent) {
          levelTreeNode.children!.forEach((v) => {
            if (!v.disabled && syntheticCheckedKeySet.has(v.key)) {
              syntheticCheckedKeySet.delete(v.key);
            }
          });
        }
        syntheticCheckedKeySet.add(levelTreeNodeKey);
      } else if (partialChecked) {
        syntheticIndeterminateKeySet.add(levelTreeNodeKey);
      }
      if (levelIsZero && checkStrategyIsChild && syntheticCheckedKeySet.has(levelTreeNodeKey)) {
        syntheticCheckedKeySet.delete(levelTreeNodeKey);
      }
    }
  }
  return {
    checkedKeys: Array.from(syntheticCheckedKeySet),
    indeterminateKeys: Array.from(syntheticIndeterminateKeySet),
  };
}

// unchecking is safe when doing cascade uncheck in async mode
/**
 * 计算扩展选中 key 集合：把每个选中节点连同其可达子孙并入集合，遇 disabled 子树停止下钻；
 * 子树未完全加载时，勾选流程抛出 SubtreeNotLoadedError，取消勾选流程安全截断。
 * @param checkedKeys - 当前选中的节点 key 列表
 * @param treeMate - 树 mate 实例，提供节点映射与 getChildren
 * @param isUnchecking - 是否处于取消勾选流程，决定未加载子树的处理方式
 * @returns 含全部级联选中节点的 key 集合
 */
export function getExtendedCheckedKeySet<R, G, I>(
  checkedKeys: Key[],
  treeMate: TreeMate<R, G, I>,
  isUnchecking: boolean = false,
): Set<Key> {
  const { treeNodeMap, getChildren } = treeMate;
  const visitedKeySet: Set<Key> = new Set();
  const extendedKeySet: Set<Key> = new Set(checkedKeys);
  checkedKeys.forEach((checkedKey) => {
    const checkedTreeNode = treeNodeMap.get(checkedKey);
    if (checkedTreeNode !== undefined) {
      traverseWithCb(checkedTreeNode, (treeNode) => {
        if (treeNode.disabled) {
          return TRAVERSE_COMMAND.STOP;
        }
        const { key } = treeNode;
        if (visitedKeySet.has(key)) return;
        visitedKeySet.add(key);
        // Adding keys before loaded check is okay, since if not valid error
        // would be thrown
        extendedKeySet.add(key);
        if (isExpilicitlyNotLoaded(treeNode.rawNode, getChildren)) {
          if (isUnchecking) {
            return TRAVERSE_COMMAND.STOP;
          } else {
            throw new SubtreeNotLoadedError();
          }
        }
      });
    }
  });
  return extendedKeySet;
}
