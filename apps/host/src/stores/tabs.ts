import { defineStore } from "pinia";
import { nextTick } from "vue";
import type { TabOpenPayload, TabRoutePayload, TabTitlePayload } from "@repo/wujie-kit";
import { buildTabKey, parseTabUrl } from "@repo/wujie-kit/host";
import type { TabState } from "@repo/wujie-kit/host";
import type { HostApp } from "../apps";

export const TABS_STORAGE_KEY = "wujie-mvp:tabs:v1";

/** 保活实例上限:超过后把最久未激活的 background 实例销毁(转 cold,激活时重建) */
export const TAB_ALIVE_LIMIT = 8;

export interface TabRecord {
  /** 确定性去重键:buildTabKey(app, page, query);创建后身份不变(Tab 内导航只改 page/query) */
  id: string;
  app: string;
  page: string;
  query?: Record<string, string>;
  title: string;
  state: TabState;
  lastActivatedAt: number;
  /** 首开序号:派生稳定容器 id(tab-container-{n}),穿越关闭与刷新不重复 */
  n: number;
}

interface TabsSnapshot {
  tabs: TabRecord[];
  activeId: string | null;
  seq: number;
}

/** 宿主环境副作用(由 wujie.ts 注入;store 保持纯状态机) */
export interface TabOps {
  /** cold → 实例化(幂等) */
  ensureInstance(tab: TabRecord): void;
  /** 销毁保活实例(LRU 降级 / 关闭 Tab) */
  destroyInstance(tab: TabRecord): Promise<void>;
}

let ops: TabOps | null = null;
let registry: HostApp[] = [];

/** @internal 由 wujie.ts 在 initWujie 时注入副作用实现 */
export function configureTabOps(next: TabOps): void {
  ops = next;
}

function assertOps(): TabOps {
  if (!ops) throw new Error("[tabs] 尚未 configureTabOps,请先调用 initWujie");
  return ops;
}

function loadSnapshot(): TabsSnapshot | null {
  try {
    const raw = sessionStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TabsSnapshot>;
    if (!Array.isArray(parsed.tabs)) return null;
    return {
      // 刷新后所有实例都已不存在:统一落回 cold,激活时重建
      tabs: parsed.tabs
        .filter(
          (tab): tab is TabRecord =>
            !!tab &&
            typeof tab.id === "string" &&
            typeof tab.app === "string" &&
            typeof tab.page === "string" &&
            typeof tab.n === "number",
        )
        .map((tab) => ({ ...tab, state: "cold" as const, lastActivatedAt: 0 })),
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      seq: typeof parsed.seq === "number" ? parsed.seq : 0,
    };
  } catch {
    return null;
  }
}

function defaultTitle(app: string, page: string): string {
  const entry = registry.find((item) => item.key === app)?.menu.find((menu) => menu.path === page);
  if (entry) return entry.label;
  // 未注册页面(如详情 /product):取末段占位,真实名由子应用 tabTitle 回报
  const segment = page.split("/").filter(Boolean).at(-1) ?? "首页";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function mainPath(tab: TabRecord): string {
  const query = Object.entries(tab.query ?? {});
  const qs = new URLSearchParams(query).toString();
  const path = `/${tab.app}${tab.page === "/" ? "" : tab.page}`;
  if (!qs) return path;
  return `${path}${tab.page.includes("?") ? "&" : "?"}${qs}`;
}

export const useTabsStore = defineStore("tabs", {
  state: () =>
    ({
      tabs: [],
      activeId: null,
      seq: 0,
    }) as TabsState,

  getters: {
    activeTab(state): TabRecord | undefined {
      return state.tabs.find((tab) => tab.id === state.activeId);
    },
    /** 有保活实例的 Tab 数(active + background) */
    aliveCount(state): number {
      return state.tabs.filter((tab) => tab.state !== "cold").length;
    },
  },

  actions: {
    /** 应用启动:sessionStorage 恢复列表 + 地址栏解析激活 Tab;激活即按需重建实例 */
    async init(apps: HostApp[]): Promise<void> {
      registry = apps;
      const saved = loadSnapshot();
      if (saved) {
        this.tabs = saved.tabs;
        // seq 必须覆盖已有 tab.n,避免重建 tab-container-N 撞号
        this.seq = Math.max(saved.seq, ...saved.tabs.map((tab) => tab.n), 0);
      }

      const parsed = parseTabUrl(window.location.href, registry);
      let urlId: string | null = null;
      if (parsed.app && parsed.page) {
        urlId = buildTabKey(parsed.app, parsed.page, parsed.query);
        let tab = this.tabs.find((item) => item.id === urlId);
        if (!tab) {
          tab = {
            id: urlId,
            app: parsed.app,
            page: parsed.page,
            query: parsed.query,
            title: defaultTitle(parsed.app, parsed.page),
            state: "cold",
            lastActivatedAt: 0,
            n: ++this.seq,
          };
          this.tabs.push(tab);
        }
        this.activeId = tab.id;
      }

      this.persist();
      if (this.activeId) await this.activate(this.activeId);
    },

    /** 打开/激活 Tab:确定性去重(同参数复用),cold 先建实例 */
    async openTab(
      app: string,
      page: string,
      query?: Record<string, string>,
      title?: string,
    ): Promise<void> {
      if (!registry.some((item) => item.key === app)) {
        console.error(`[tabs] 未注册的子应用: ${app}`);
        return;
      }
      const id = buildTabKey(app, page, query);
      let tab = this.tabs.find((item) => item.id === id);
      if (!tab) {
        tab = {
          id,
          app,
          page,
          query,
          title: title ?? defaultTitle(app, page),
          state: "cold",
          lastActivatedAt: 0,
          n: ++this.seq,
        };
        this.tabs.push(tab);
      }
      await this.activate(id);
    },

    /** 子应用 tabOpen 事件入口(带注册表校验) */
    openFromPayload(payload: TabOpenPayload): Promise<void> {
      return this.openTab(payload.app, payload.page, payload.query);
    },

    /** 激活 Tab:实例按需重建、地址栏与 sessionStorage 同步、超限触发 LRU 降级 */
    async activate(id: string): Promise<void> {
      const tab = this.tabs.find((item) => item.id === id);
      if (!tab) {
        console.error(`[tabs] 未知的 Tab: ${id}`);
        return;
      }

      let created = false;
      if (tab.state === "cold") {
        // 等待容器 div 渲染(v-for 随 state 更新),再交给 wujie 挂载
        await nextTick();
        assertOps().ensureInstance(tab);
        tab.state = "background";
        created = true;
      }

      const prev = this.activeTab;
      if (prev && prev.id !== id && prev.state === "active") prev.state = "background";

      this.activeId = id;
      tab.lastActivatedAt = Date.now();

      window.history.replaceState(null, "", mainPath(tab));
      document.title = `无界 MVP · ${tab.title}`;
      this.persist();
      if (created) this.trim();
    },

    /** 关闭 Tab:销毁实例并移除记录;激活 Tab 被关则激活相邻(左优先) */
    async closeTab(id: string): Promise<void> {
      const index = this.tabs.findIndex((item) => item.id === id);
      if (index < 0) return;
      const [tab] = this.tabs.splice(index, 1);
      if (tab.state !== "cold") {
        // 先置 cold 再销毁:销毁中若被重开,activate 走 ensure 的幂等路径
        tab.state = "cold";
        await destroyQuietly(tab);
      }

      if (this.activeId === id) {
        const neighbor = this.tabs[index - 1] ?? this.tabs[index];
        if (neighbor) {
          await this.activate(neighbor.id);
        } else {
          this.activeId = null;
          document.title = "无界 MVP · 主应用";
          window.history.replaceState(null, "", "/");
        }
      }
      this.persist();
    },

    /** 子应用 tabRoute:更新 Tab 记录(身份不变),激活 Tab 同步地址栏 */
    applyTabRoute(payload: TabRoutePayload): void {
      const tab = this.tabs.find((item) => item.id === payload.id);
      if (!tab) return; // 实例晚于 Tab 注销的迟到事件
      tab.page = payload.page;
      tab.query = payload.query;
      if (tab.id === this.activeId) {
        window.history.replaceState(null, "", mainPath(tab));
      }
      this.persist();
    },

    /** 子应用 tabTitle:host 仅信任回报,document.title 跟随激活 Tab(防多实例互抢) */
    applyTabTitle(payload: TabTitlePayload): void {
      const tab = this.tabs.find((item) => item.id === payload.id);
      if (!tab || !payload.title) return;
      tab.title = payload.title;
      if (tab.id === this.activeId) {
        document.title = `无界 MVP · ${payload.title}`;
      }
      this.persist();
    },

    /** LRU 降级:保活数超限时销毁最久未激活的 background 实例(保留下次重载所需记录) */
    trim(): void {
      while (this.aliveCount > TAB_ALIVE_LIMIT) {
        const victim = this.tabs
          .filter((item) => item.state === "background")
          .sort((a, b) => a.lastActivatedAt - b.lastActivatedAt)[0];
        if (!victim) break;
        victim.state = "cold";
        void destroyQuietly(victim);
      }
      this.persist();
    },

    persist(): void {
      sessionStorage.setItem(
        TABS_STORAGE_KEY,
        JSON.stringify({ tabs: this.tabs, activeId: this.activeId, seq: this.seq }),
      );
    },
  },
});

type TabsState = {
  tabs: TabRecord[];
  activeId: string | null;
  seq: number;
};

async function destroyQuietly(tab: TabRecord): Promise<void> {
  try {
    await assertOps().destroyInstance({ ...tab });
  } catch (error) {
    console.error(`[tabs] 销毁实例失败(${tab.id}):`, error);
  }
}
