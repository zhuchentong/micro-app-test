/*!
 * 移植自 treemate v0.3.11 —— https://github.com/07akioni/treemate
 * MIT License · Copyright (c) 07akioni
 * 本地改动：无实质改动。
 */
import type { GetPrevNextOptions, TreeNode } from "./interface";

/**
 * 返回树中第一个可用节点（非 group、非 ignored、非 disabled）；
 * 首节点不可用时沿 getNext 继续向后找。
 * @param nodes - 顶层节点列表
 * @returns 首个可用节点；整树不可用时返回 null
 */
export function getFirstAvailableNode<R, G, I>(
  nodes: Array<TreeNode<R, G, I>>,
): TreeNode<R> | null {
  if (nodes.length === 0) return null;
  const node = nodes[0]!;
  if (node.isGroup || node.ignored || node.disabled) {
    return node.getNext();
  }
  return node as unknown as TreeNode<R>;
}

/**
 * 取同级下一兄弟节点；loop 为 true 时越过末尾循环回首节点，否则返回 null。
 * @param node - 当前节点
 * @param loop - 是否循环绕回
 * @returns 下一兄弟节点或 null
 */
function rawGetNext(node: TreeNode, loop: boolean): TreeNode | null {
  const sibs = node.siblings;
  const l = sibs.length;
  const { index } = node;
  if (loop) {
    return sibs[(index + 1) % l]!;
  } else {
    if (index === sibs.length - 1) return null;
    return sibs[index + 1]!;
  }
}

/**
 * 沿 dir 方向游标移动到下一个可用节点（非 group、非 ignored；disabled 需 includeDisabled），
 * 遇 group 节点下钻其子节点；loop 为 true 时绕树循环一周回到起点即以起点为结果。
 * @param fromNode - 起始节点
 * @param dir - 移动方向：prev 向前、next 向后
 * @param root0 - 移动选项对象（GetPrevNextOptions）
 * @param root0.loop - 到达端点后是否循环绕回
 * @param root0.includeDisabled - 是否把 disabled 节点纳入游标可达范围
 * @returns 目标节点；无可达节点时返回 null
 */
function move(
  fromNode: TreeNode,
  dir: "prev" | "next",
  { loop = false, includeDisabled = false }: GetPrevNextOptions = {},
): TreeNode | null {
  const iterate = dir === "prev" ? rawGetPrev : rawGetNext;
  const getChildOptions = {
    reverse: dir === "prev",
  };
  let meet = false;
  let endNode: TreeNode | null = null;
  /**
   * 沿方向游标遍历，记录第一个遇到的可用节点。
   * @param node - 当前游标节点
   * @returns 无返回值
   */
  function traverse(node: TreeNode | null): void {
    if (node === null) return;
    if (node === fromNode) {
      if (!meet) {
        meet = true;
      } else if (!fromNode.disabled && !fromNode.isGroup) {
        endNode = fromNode;
        return;
      }
    } else {
      if ((!node.disabled || includeDisabled) && !node.ignored && !node.isGroup) {
        endNode = node;
        return;
      }
    }
    if (node.isGroup) {
      const child = getChild(node, getChildOptions);
      if (child !== null) {
        endNode = child;
      } else {
        traverse(iterate(node, loop));
      }
    } else {
      const nextNode = iterate(node, false);
      if (nextNode !== null) {
        traverse(nextNode);
      } else {
        const parent = rawGetParent(node);
        if (parent?.isGroup) {
          traverse(iterate(parent, loop));
        } else if (loop) {
          traverse(iterate(node, true));
        }
      }
    }
  }
  traverse(fromNode);
  return endNode;
}

/**
 * 取同级上一兄弟节点；loop 为 true 时越过开头循环回尾节点，否则返回 null。
 * @param node - 当前节点
 * @param loop - 是否循环绕回
 * @returns 上一兄弟节点或 null
 */
function rawGetPrev(node: TreeNode, loop: boolean): TreeNode | null {
  const sibs = node.siblings;
  const l = sibs.length;
  const { index } = node;
  if (loop) {
    return sibs[(index - 1 + l) % l]!;
  } else {
    if (index === 0) return null;
    return sibs[index - 1]!;
  }
}

/**
 * 取节点的直接父节点。
 * @param node - 当前节点
 * @returns 父节点；根节点返回 null
 */
function rawGetParent(node: TreeNode): TreeNode | null {
  return node.parent;
}

/**
 * 取节点下第一个可用子节点（非 disabled、非 ignored，递归下钻 group）；
 * reverse 为 true 时从末尾向前查找。
 * @param node - 父节点
 * @param options - 查找选项；reverse 表示从末尾向前查找
 * @returns 可用子节点；不存在时返回 null
 */
function getChild(node: TreeNode, options: { reverse?: boolean } = {}): TreeNode | null {
  const { reverse = false } = options;
  const { children } = node;
  if (children) {
    const { length } = children;
    const start = reverse ? length - 1 : 0;
    const end = reverse ? -1 : length;
    const delta = reverse ? -1 : 1;
    for (let i = start; i !== end; i += delta) {
      const child = children[i]!;
      if (!child.disabled && !child.ignored) {
        if (child.isGroup) {
          const childInGroup = getChild(child, options);
          if (childInGroup !== null) return childInGroup;
        } else {
          return child;
        }
      }
    }
  }
  return null;
}

export const moveMethods: Pick<TreeNode, "getChild" | "getNext" | "getParent" | "getPrev"> = {
  getChild(this: TreeNode) {
    if (this.ignored) return null;
    return getChild(this);
  },
  getParent(this: TreeNode) {
    const { parent } = this;
    if (parent?.isGroup) {
      return parent.getParent();
    }
    return parent;
  },
  getNext(this: TreeNode, options: GetPrevNextOptions = {}) {
    return move(this, "next", options);
  },
  getPrev(this: TreeNode, options: GetPrevNextOptions = {}) {
    return move(this, "prev", options);
  },
};
