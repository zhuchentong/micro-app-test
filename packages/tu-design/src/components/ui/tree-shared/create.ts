/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：process.env.NODE_ENV 守卫替换为 import.meta.env?.DEV。
 */
import type {
  CheckOptions,
  GetChildren,
  GetNonLeafKeysOptions,
  GetPathOptions,
  GetPrevNextOptions,
  InputMergedKeys,
  Key,
  LevelTreeNodeMap,
  RawNode,
  TreeMate,
  TreeMateOptions,
  TreeNode,
  TreeNodeMap,
} from "./interface";
import { getCheckedKeys } from "./check";
import {
  defaultGetChildren,
  defaultGetKey,
  getNonLeafKeys,
  isDisabled,
  isGroup,
  isIgnored,
  isLeaf,
  isNodeInvalid,
  isShallowLoaded,
  toArray,
  unwrapCheckedKeys,
  unwrapIndeterminateKeys,
} from "./utils";
import { getPath } from "./path";
import { getFirstAvailableNode, moveMethods } from "./move";
import { flatten } from "./flatten";
import { contains } from "./contains";

/**
 * 递归构建树节点：以 nodeProto 为原型创建实例，回填 siblings/level/index/父子
 * 等结构信息，并把每个节点登记进 treeNodeMap 与 levelTreeNodeMap。
 * @param rawNodes - 当前层级的原始节点数组
 * @param treeNodeMap - key → 节点 的全量映射（原地写入）
 * @param levelTreeNodeMap - 层级 → 该层节点列表 的映射（原地写入）
 * @param nodeProto - 节点实例共享的原型（惰性 getter 与移动方法）
 * @param getChildren - 取子节点的函数
 * @param parent - 父节点；根层调用时为 null
 * @param level - 当前层级，根为 0
 * @returns 当前层级构建好的节点数组
 */
function createTreeNodes<R, G, I>(
  rawNodes: Array<R | G | I>,
  treeNodeMap: TreeNodeMap<R, G, I>,
  levelTreeNodeMap: LevelTreeNodeMap<R, G, I>,
  nodeProto: any,
  getChildren: GetChildren<R, G, I>,
  parent: TreeNode<R, G> | null = null,
  level: number = 0,
): Array<TreeNode<R, G, I>> {
  const treeNodes: Array<TreeNode<R, G, I>> = [];
  rawNodes.forEach((rawNode, index) => {
    if (import.meta.env?.DEV && isNodeInvalid(rawNode, getChildren)) {
      console.error("[treemate]: node", rawNode, "is invalid");
    }
    const treeNode: TreeNode<R, G, I> = Object.create(nodeProto);
    treeNode.rawNode = rawNode;
    treeNode.siblings = treeNodes;
    treeNode.level = level;
    treeNode.index = index;
    treeNode.isFirstChild = index === 0;
    treeNode.isLastChild = index + 1 === rawNodes.length;
    treeNode.parent = parent;
    if (!treeNode.ignored) {
      const rawChildren = getChildren(rawNode as R | G);
      if (Array.isArray(rawChildren)) {
        treeNode.children = createTreeNodes<R, G, I>(
          rawChildren,
          treeNodeMap,
          levelTreeNodeMap,
          nodeProto,
          getChildren,
          treeNode as unknown as TreeNode<R, G>,
          level + 1,
        );
      }
    }
    treeNodes.push(treeNode);
    treeNodeMap.set(treeNode.key, treeNode);
    if (!levelTreeNodeMap.has(level)) levelTreeNodeMap.set(level, []);
    levelTreeNodeMap.get(level)?.push(treeNode);
  });
  return treeNodes as any;
}

/**
 * 创建 TreeMate 实例：以 options 覆盖默认的取 key/子节点/禁用等策略，构建共享节点原型
 * （惰性 getter 与移动、contains 方法），并暴露节点查询、路径、展开拍平与勾选级联计算等 API。
 * @param rawNodes - 原始节点树
 * @param options - 自定义策略（getKey/getChildren/getDisabled/getIgnored/getIsGroup、
 *   ignoreEmptyChildren 等）；缺省走默认实现
 * @returns TreeMate 实例
 */
export function createTreeMate<R = RawNode, G = R, I = R>(
  rawNodes: Array<R | G | I>,
  options: TreeMateOptions<R, G, I> = {},
): TreeMate<R, G, I> {
  const treeNodeMap: TreeNodeMap<R, G, I> = new Map();
  const levelTreeNodeMap: LevelTreeNodeMap<R, G, I> = new Map();
  const {
    getDisabled = isDisabled,
    getIgnored = isIgnored,
    getIsGroup = isGroup,
    getKey = defaultGetKey,
  } = options;
  const _getChildren = options.getChildren ?? defaultGetChildren;
  const getChildren = options.ignoreEmptyChildren
    ? (node: R | I | G) => {
        const children = _getChildren(node);
        if (Array.isArray(children)) {
          if (!children.length) return null;
          return children;
        }
        return children;
      }
    : _getChildren;
  const nodeProto = Object.assign(
    {
      get key(): Key {
        // do not pass parent or related things to it
        // the key need to be specified explicitly
        return getKey((this as any).rawNode);
      },
      get disabled(): boolean {
        return getDisabled((this as any).rawNode);
      },
      get isGroup(): boolean {
        return getIsGroup((this as any).rawNode);
      },
      get isLeaf(): boolean {
        return isLeaf((this as any).rawNode, getChildren);
      },
      get shallowLoaded(): boolean {
        return isShallowLoaded((this as any).rawNode, getChildren);
      },
      get ignored(): boolean {
        return getIgnored((this as any).rawNode);
      },
      contains<R, G, I>(this: TreeNode<R, G, I>, node: TreeNode<R, G, I>): boolean {
        return contains(this, node);
      },
    },
    moveMethods,
  );

  const treeNodes: Array<TreeNode<R, G, I>> = createTreeNodes<R, G, I>(
    rawNodes,
    treeNodeMap,
    levelTreeNodeMap,
    nodeProto,
    getChildren,
  );
  // get only raw node
  /**
   * 按 key 获取节点，仅返回非 group、非 ignored 的普通节点。
   * @param key - 节点 key；null/undefined 返回 null
   * @returns 对应节点；不存在或不可用时返回 null
   */
  function getNode<T extends Key | null | undefined>(
    key: T,
  ): T extends null | undefined ? null : TreeNode<R>;
  function getNode(key: Key | null | undefined): TreeNode<R> | null {
    if (key === null || key === undefined) return null;
    const tmNode = treeNodeMap.get(key);
    if (tmNode && !tmNode.isGroup && !tmNode.ignored) {
      return tmNode as unknown as TreeNode<R>;
    }
    return null;
  }
  // get group & raw node, for internally usage
  /**
   * 按 key 获取节点（含 group 节点，供内部移动/路径逻辑使用）。
   * @param key - 节点 key；null/undefined 返回 null
   * @returns 对应节点；不存在或被忽略时返回 null
   */
  function _getNode<T extends Key | null | undefined>(
    key: T,
  ): T extends null | undefined ? null : TreeNode<R, G>;
  function _getNode(key: Key | null | undefined): TreeNode<R, G> | null {
    if (key === null || key === undefined) return null;
    const tmNode = treeNodeMap.get(key);
    if (tmNode && !tmNode.ignored) {
      return tmNode as unknown as TreeNode<R, G>;
    }
    return null;
  }
  /**
   * 按 key 获取相邻的前一个可用节点。
   * @param key - 节点 key；null/undefined 返回 null
   * @param options - 移动选项
   * @returns 前一个可用节点；无入参对应节点或无相邻节点时返回 null
   */
  function getPrev<T extends Key | null | undefined>(
    key: T,
    options?: GetPrevNextOptions,
  ): T extends null | undefined ? null : TreeNode<R>;
  function getPrev(key: Key | null | undefined, options?: GetPrevNextOptions): TreeNode<R> | null {
    const node = _getNode(key);
    if (!node) return null;
    return node.getPrev(options);
  }
  /**
   * 按 key 获取相邻的下一个可用节点。
   * @param key - 节点 key；null/undefined 返回 null
   * @param options - 移动选项
   * @returns 下一个可用节点；无入参对应节点或无相邻节点时返回 null
   */
  function getNext<T extends Key | null | undefined>(
    key: T,
    options?: GetPrevNextOptions,
  ): T extends null | undefined ? null : TreeNode<R>;
  function getNext(key: Key | null | undefined, options?: GetPrevNextOptions): TreeNode<R> | null {
    const node = _getNode(key);
    if (!node) return null;
    return node.getNext(options);
  }
  /**
   * 按 key 获取父节点（跳过 group 节点）。
   * @param key - 节点 key；null/undefined 返回 null
   * @returns 父节点；无入参对应节点或已到根时返回 null
   */
  function getParent<T extends Key | null | undefined>(
    key: T,
  ): T extends null | undefined ? null : TreeNode<R>;
  function getParent(key: Key | null | undefined): TreeNode<R> | null {
    const node = _getNode(key);
    if (!node) return null;
    return node.getParent();
  }
  /**
   * 按 key 获取第一个可用子节点。
   * @param key - 节点 key；null/undefined 返回 null
   * @returns 第一个可用子节点；无入参对应节点或无子节点时返回 null
   */
  function getChild<T extends Key | null | undefined>(
    key: T,
  ): T extends null | undefined ? null : TreeNode<R>;
  function getChild(key: Key | null | undefined): TreeNode<R> | null {
    const node = _getNode(key);
    if (!node) return null;
    return node.getChild();
  }
  const treemate: TreeMate<R, G, I> = {
    treeNodes,
    treeNodeMap,
    levelTreeNodeMap,
    maxLevel: Math.max(...levelTreeNodeMap.keys()),
    getChildren,
    getFlattenedNodes(expandedKeys?: Key[]) {
      return flatten(treeNodes, expandedKeys);
    },
    getNode,
    getPrev,
    getNext,
    getParent,
    getChild,
    getFirstAvailableNode() {
      return getFirstAvailableNode(treeNodes);
    },
    getPath<T extends boolean>(key: Key | null | undefined, options: GetPathOptions<T> = {}) {
      return getPath<R, G, I, T>(key, options, treemate);
    },
    getCheckedKeys(
      checkedKeys: Key[] | InputMergedKeys | null | undefined,
      options: CheckOptions = {},
    ) {
      const { cascade = true, leafOnly = false, checkStrategy = "all" } = options;
      return getCheckedKeys(
        {
          checkedKeys: unwrapCheckedKeys(checkedKeys),
          indeterminateKeys: unwrapIndeterminateKeys(checkedKeys),
          cascade,
          leafOnly,
          checkStrategy,
        },
        treemate,
      );
    },
    check(
      keysToCheck: Key | Key[] | null | undefined,
      checkedKeys: Key[] | InputMergedKeys,
      options: CheckOptions = {},
    ) {
      const { cascade = true, leafOnly = false, checkStrategy = "all" } = options;
      return getCheckedKeys(
        {
          checkedKeys: unwrapCheckedKeys(checkedKeys),
          indeterminateKeys: unwrapIndeterminateKeys(checkedKeys),
          keysToCheck:
            keysToCheck === undefined || keysToCheck === null ? [] : toArray(keysToCheck),
          cascade,
          leafOnly,
          checkStrategy,
        },
        treemate,
      );
    },
    uncheck(
      keysToUncheck: Key | Key[] | null | undefined,
      checkedKeys: Key[] | InputMergedKeys,
      options: CheckOptions = {},
    ) {
      const { cascade = true, leafOnly = false, checkStrategy = "all" } = options;
      return getCheckedKeys(
        {
          checkedKeys: unwrapCheckedKeys(checkedKeys),
          indeterminateKeys: unwrapIndeterminateKeys(checkedKeys),
          keysToUncheck:
            keysToUncheck === null || keysToUncheck === undefined ? [] : toArray(keysToUncheck),
          cascade,
          leafOnly,
          checkStrategy,
        },
        treemate,
      );
    },
    getNonLeafKeys(options: GetNonLeafKeysOptions = {}) {
      return getNonLeafKeys(treeNodes, options);
    },
  };
  return treemate;
}
