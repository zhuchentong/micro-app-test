import { defineStore } from "pinia";

export const LAYOUT_STORAGE_KEY = "wujie-mvp:layout:v1";

/** 布局名白名单:layouts/index.ts 的注册表 key 必须与此一一对应(Record 类型强制) */
const LAYOUT_NAMES = ["workspace", "blank"] as const;

export type LayoutName = (typeof LAYOUT_NAMES)[number];

/** 缺省布局:持久化缺失/损坏/非法值时回落 */
const DEFAULT_LAYOUT: LayoutName = "workspace";

/**
 * 从 localStorage 读取并校验布局名;缺失/损坏/非法值一律回落 DEFAULT_LAYOUT(不抛出)
 * @returns 合法的布局名 + 是否存在合法的持久化记录(刷新恢复的优先级判定依据)
 */
function loadLayout(): { current: LayoutName; stored: boolean } {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    return LAYOUT_NAMES.includes(raw as LayoutName)
      ? { current: raw as LayoutName, stored: true }
      : { current: DEFAULT_LAYOUT, stored: false };
  } catch {
    return { current: DEFAULT_LAYOUT, stored: false };
  }
}

/**
 * host 布局偏好状态(workspace 工作台 / blank 专注模式),localStorage 持久化跨会话保留。
 * 布局恢复优先级:手动选择(持久化)优先;无记录时由 App.vue 兜底为激活 Tab 子应用的默认布局。
 */
export const useLayoutStore = defineStore("layout", {
  state: () => {
    const loaded = loadLayout();
    return {
      current: loaded.current,
      /** 仅反映初始加载时是否有合法持久化记录;此后 setLayout 会写存储,该值不再维护 */
      hasStoredLayout: loaded.stored,
    } as { current: LayoutName; hasStoredLayout: boolean };
  },
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

    /**
     * 打开新 Tab 时应用该子应用的默认布局(去重命中已有 Tab 时不改变布局,
     * 已有 Tab 之间的激活不触发布局跟随)
     * @param defaultLayout 子应用配置的默认布局
     * @param created 本次 openTab 是否新建了 Tab(tabs.openTab 返回值)
     */
    applyAppDefault(defaultLayout: LayoutName, created: boolean): void {
      if (!created) return;
      this.setLayout(defaultLayout);
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
