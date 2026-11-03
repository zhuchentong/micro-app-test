import { defineStore } from "pinia";

export const LAYOUT_STORAGE_KEY = "wujie-mvp:layout:v1";

/** 布局名白名单:layouts/index.ts 的注册表 key 必须与此一一对应(Record 类型强制) */
const LAYOUT_NAMES = ["workspace", "blank"] as const;

export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** 缺省布局:持久化缺失/损坏/非法值时回落 */
const DEFAULT_LAYOUT: LayoutName = "workspace";

/**
 * 从 localStorage 读取并校验布局名;缺失/损坏/非法值一律回落 workspace(不抛出)
 * @returns 合法的布局名
 */
function loadLayout(): LayoutName {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return LAYOUT_NAMES.includes(raw as LayoutName) ? (raw as LayoutName) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** host 布局偏好状态(workspace 工作台 / blank 专注模式),localStorage 持久化跨会话保留 */
export const useLayoutStore = defineStore("layout", {
  state: () =>
    ({
      current: loadLayout(),
    }) as { current: LayoutName },
  actions: {
    /**
     * 切换布局并持久化;未注册的布局名忽略并告警(运行时守卫,防动态字符串误用)
     * @param name 目标布局名
     */
    setLayout(name: LayoutName): void {
      if (!LAYOUT_NAMES.includes(name)) {
        console.error(`[layout] 未注册的布局: ${String(name)}`);
        return;
      }
      this.current = name;
      this.persist();
    },

    /** 写入 localStorage(读写都在 store 内,与 theme-custom 的持久化模式一致) */
    persist(): void {
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, this.current);
      } catch (error) {
        console.error("[layout] 布局偏好持久化失败:", error);
      }
    },
  },
});
