/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：defaultGetChildren 返回类型同步 GetChildren 塌缩为 `unknown`（语义不变）。
 */
import type {
  GetChildren,
  GetNonLeafKeysOptions,
  InputMergedKeys,
  Key,
  RawNode,
  TreeNode,
} from "./interface";

/**
 * 把任意值归一为数组：本身是数组则原样返回，否则包装为单元素数组。
 * @param arg - 任意输入值
 * @returns 数组形式的输入值
 */
export function toArray<T>(arg: T): T extends any[] ? T : T[] {
  if (Array.isArray(arg)) return arg as any;
  return [arg] as any;
}

// Do not use enum for lint plugin has error
export const TRAVERSE_COMMAND = {
  STOP: "STOP",
};

/**
 * 深度优先遍历节点子树，callback 返回 STOP 指令时终止该分支的继续下钻。
 * @param treeNode - 遍历起点节点
 * @param callback - 访问每个节点时执行的回调
 * @returns 无返回值
 */
export function traverseWithCb<R, G, I>(
  treeNode: TreeNode<R, G, I>,
  callback: (treeNode: TreeNode<R, G, I>) => any,
): void {
  const command = callback(treeNode);
  if (treeNode.children !== undefined && command !== TRAVERSE_COMMAND.STOP) {
    treeNode.children.forEach((childNode) => traverseWithCb(childNode, callback));
  }
}

/**
 * 收集树中所有非叶子节点的 key；preserveGroup 为 true 时保留 group 节点，
 * 否则排除 group，仅返回普通父节点 key。
 * @param treeNodes - 待收集的节点树
 * @param options - 选项；preserveGroup 控制是否包含 group 节点
 * @returns 非叶子节点 key 列表
 */
export function getNonLeafKeys<R, G, I>(
  treeNodes: Array<TreeNode<R, G, I>>,
  options: GetNonLeafKeysOptions = {},
): Key[] {
  const { preserveGroup = false } = options;
  const keys: Key[] = [];
  const cb = preserveGroup
    ? (node: TreeNode<R, G, I>) => {
        if (!node.isLeaf) {
          keys.push(node.key);
          traverse(node.children as Array<TreeNode<R, G, I>>);
        }
      }
    : (node: TreeNode<R, G, I>) => {
        if (!node.isLeaf) {
          if (!node.isGroup) keys.push(node.key);
          traverse(node.children as Array<TreeNode<R, G, I>>);
        }
      };
  /**
   * 用预设回调遍历当前层节点列表。
   * @param nodes - 当前层的节点列表
   * @returns 无返回值
   */
  function traverse(nodes: Array<TreeNode<R, G, I>>): void {
    nodes.forEach(cb);
  }
  traverse(treeNodes);
  return keys;
}

/**
 * 判断原始节点是否为叶子：显式 isLeaf 字段优先，否则以取不到子节点视为叶子。
 * @param rawNode - 原始节点数据
 * @param getChildren - 取子节点的函数
 * @returns 是否为叶子节点
 */
export function isLeaf<R = RawNode, G = R, I = R>(
  rawNode: R | G | I,
  getChildren: GetChildren<R, G, I>,
): boolean {
  const { isLeaf } = rawNode as any;
  if (isLeaf !== undefined) return isLeaf;
  else if (!getChildren(rawNode)) return true;
  return false;
}

/**
 * 默认取子节点实现：读取节点数据的 children 字段。
 * @param node - 原始节点数据
 * @returns 子节点数组或 undefined
 */
export function defaultGetChildren<R, G, I>(node: R | G | I): unknown {
  return (node as any).children;
}

/**
 * 默认取 key 实现：读取节点数据的 key 字段。
 * @param node - 原始节点数据
 * @returns 节点 key
 */
export function defaultGetKey(node: unknown): Key {
  return (node as any).key;
}

/**
 * 默认的节点忽略判定：始终返回 false。
 * @returns 恒为 false
 */
export function isIgnored(): boolean {
  return false;
}

/**
 * 判断节点是否处于浅加载完成状态：显式 isLeaf=false 但取不到子节点数组时视为未加载，
 * 其余情况（含已加载）均视为完成。
 * @param rawNode - 原始节点数据
 * @param getChildren - 取子节点的函数
 * @returns 节点是否已浅加载
 */
export function isShallowLoaded<R = RawNode, G = R, I = R>(
  rawNode: R,
  getChildren: GetChildren<R, G, I>,
): boolean {
  const { isLeaf } = rawNode as any;
  if (isLeaf === false && !Array.isArray(getChildren(rawNode))) return false;
  return true;
}

/**
 * 判断原始节点是否被禁用。
 * @param rawNode - 原始节点数据
 * @returns disabled === true 时返回 true
 */
export function isDisabled(rawNode: RawNode): boolean {
  return rawNode.disabled === true;
}

/**
 * 判断节点是否显式未加载：isLeaf === false 且 getChildren 未返回数组
 * （异步加载占位，子树尚未到位）。
 * @param rawNode - 原始节点数据
 * @param getChildren - 取子节点的函数
 * @returns 是否显式未加载
 */
export function isExpilicitlyNotLoaded<R = RawNode, G = R, I = R>(
  rawNode: R | G | I,
  getChildren: GetChildren<R, G, I>,
): boolean {
  return (rawNode as any).isLeaf === false && !Array.isArray(getChildren(rawNode));
}

/**
 * 判断节点数据是否非法：声明 isLeaf === true 却仍返回非空子节点数组。
 * @param rawNode - 原始节点数据
 * @param getChildren - 取子节点的函数
 * @returns 数据非法时返回 true
 */
export function isNodeInvalid<R = RawNode, G = R, I = R>(
  rawNode: R | G | I,
  getChildren: GetChildren<R, G, I>,
): boolean {
  if ((rawNode as any).isLeaf === true) {
    const children = getChildren(rawNode);
    if (Array.isArray(children) && children.length > 0) return true;
  }
  return false;
}

/**
 * 从勾选结果中取出选中 key 列表：兼容 key 数组直传与 merged 结果对象两种形态，
 * 空值返回空数组。
 * @param result - 勾选结果（key 数组、merged 对象或空值）
 * @returns 选中 key 数组
 */
export function unwrapCheckedKeys(result?: InputMergedKeys | Key[] | null): Key[] {
  if (result === undefined || result === null) return [];
  if (Array.isArray(result)) return result;
  return result.checkedKeys ?? [];
}

/**
 * 从勾选结果中取出半选 key 列表：仅 merged 结果对象包含该信息，
 * 数组与空值均返回空数组。
 * @param result - 勾选结果（key 数组、merged 对象或空值）
 * @returns 半选 key 数组
 */
export function unwrapIndeterminateKeys(result?: InputMergedKeys | Key[] | null): Key[] {
  if (result === undefined || result === null || Array.isArray(result)) {
    return [];
  }
  return result.indeterminateKeys ?? [];
}

/**
 * 求并集：把 keysToAdd 中不存在的 key 追加到 originalKeys，保持原有顺序。
 * @param originalKeys - 原始 key 列表
 * @param keysToAdd - 待追加的 key 列表
 * @returns 合并去重后的 key 列表
 */
export function merge(originalKeys: Key[], keysToAdd: Key[]): Key[] {
  const set = new Set(originalKeys);
  keysToAdd.forEach((key) => {
    if (!set.has(key)) {
      set.add(key);
    }
  });
  return Array.from(set);
}

/**
 * 求差集：从 originalKeys 中移除 keysToRemove 里出现的 key，保持原有顺序。
 * @param originalKeys - 原始 key 列表
 * @param keysToRemove - 待移除的 key 列表
 * @returns 移除后的 key 列表
 */
export function minus(originalKeys: Key[], keysToRemove: Key[]): Key[] {
  const set = new Set(originalKeys);
  keysToRemove.forEach((key) => {
    if (set.has(key)) {
      set.delete(key);
    }
  });
  return Array.from(set);
}

/**
 * 判断原始节点是否为 group 分组节点（type === "group"）。
 * @param rawNode - 原始节点数据
 * @returns 是否 group 节点
 */
export function isGroup(rawNode: RawNode): boolean {
  return rawNode?.type === "group";
}

export type IndexGetter = (key: Key) => number | null;

/**
 * 构建扁平节点列表的 key → 下标查询器，用于 O(1) 定位节点在扁平序列中的位置。
 * @param treeNodes - 扁平节点列表
 * @returns 查询函数：返回 key 对应下标，未命中返回 null
 */
export function createIndexGetter<R, G, I>(treeNodes: Array<TreeNode<R, G, I>>): IndexGetter {
  const map = new Map<Key, number>();
  treeNodes.forEach((treeNode, i) => {
    map.set(treeNode.key, i);
  });
  return (key: Key) => map.get(key) ?? null;
}
