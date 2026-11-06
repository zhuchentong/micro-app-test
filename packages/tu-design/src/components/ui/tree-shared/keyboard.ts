/*!
 * 树形键盘游标移动（本仓库自研，供 TreeSelect / Cascader 面板共用）。
 */

import type { Key, RawNode, TreeNode } from "./interface";

export type MoveKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/**
 * 计算键盘移动后的活动节点 key。
 * - 仅在非 disabled 节点间移动；loop 默认 true（末尾循环回首行）。
 * - activeKey 为 null 或不在候选序列时，ArrowDown 从首行开始、ArrowUp 从末行开始。
 * @param flattened - 已展开的扁平节点列表
 * @param activeKey - 当前活动节点 key；null 表示尚无活动节点
 * @param key - 本次键盘操作（ArrowDown/ArrowUp/Home/End）
 * @param options - 选项；loop 控制到端点后是否循环绕回（默认 true）
 * @returns 移动后的活动节点 key；无可用候选节点时返回 null
 */
export function nextActiveKey<R = RawNode, G = R, I = R>(
  flattened: Array<TreeNode<R, G, I>>,
  activeKey: Key | null,
  key: MoveKey,
  options?: { loop?: boolean },
): Key | null {
  const loop = options?.loop ?? true;
  const candidates = flattened.filter((n) => !n.disabled);
  if (candidates.length === 0) return null;
  const found = activeKey === null ? -1 : candidates.findIndex((n) => n.key === activeKey);
  switch (key) {
    case "Home":
      return candidates[0]!.key;
    case "End":
      return candidates[candidates.length - 1]!.key;
    case "ArrowDown": {
      if (found === -1) return candidates[0]!.key;
      const nextIndex = found + 1;
      if (nextIndex >= candidates.length) {
        return loop ? candidates[0]!.key : candidates[found]!.key;
      }
      return candidates[nextIndex]!.key;
    }
    case "ArrowUp": {
      if (found === -1) return candidates[candidates.length - 1]!.key;
      const prevIndex = found - 1;
      if (prevIndex < 0) {
        return loop ? candidates[candidates.length - 1]!.key : candidates[0]!.key;
      }
      return candidates[prevIndex]!.key;
    }
  }
}
