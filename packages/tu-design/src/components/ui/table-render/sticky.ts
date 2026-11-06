export interface StickyInfo {
  side: "left" | "right";
  offset: number;
  edge: boolean;
}

export type StickyMap = Map<string, StickyInfo>;

/**
 * sticky 定位样式；head 为 true 时 z-index 高于表体（表头压住表体 sticky）
 * @param sticky - 列 key → sticky 信息的映射
 * @param key - 列 key
 * @param head - 是否为表头单元格（true 使用更高的 --z-sticky-head）
 * @returns inline style 对象；列非 sticky 时返回 undefined
 */
export function stickyStyle(sticky: StickyMap, key: string, head = false) {
  const info = sticky.get(key);
  if (!info) return undefined;
  return {
    position: "sticky" as const,
    [info.side]: `${info.offset}px`,
    zIndex: head ? "var(--z-sticky-head)" : "var(--z-sticky)",
  };
}

/**
 * sticky 底色（防滚动透出）与交界分隔边框
 * @param sticky - 列 key → sticky 信息的映射
 * @param key - 列 key
 * @returns class 列表（未命中项为空串）；列非 sticky 时返回 undefined
 */
export function stickyClass(sticky: StickyMap, key: string) {
  const info = sticky.get(key);
  if (!info) return undefined;
  return [
    "bg-background",
    info.side === "left" && info.edge ? "border-r border-border" : "",
    info.side === "right" && info.edge ? "border-l border-border" : "",
  ];
}
