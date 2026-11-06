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
  /** cold → 实例化(幂等);启动失败时经 onFailed 回调(含异步失败) */
  ensureInstance(tab: TabRecord, onFailed?: (error: unknown) => void): void;
  /** 销毁保活实例(LRU 降级 / 关闭 Tab) */
  destroyInstance(tab: TabRecord): Promise<void>;
  /** 纠偏已保活实例:向子应用下发 tabNavigate,令其路由跳到记录当前 page(身份不变) */
  navigateTab(tab: TabRecord): void;
}

let ops: TabOps | null = null;
let registry: HostApp[] = [];

/**
 * 由 wujie.ts 在 initWujie 时注入副作用实现(注册表同步保存,校验不依赖 init 时序)
 * @internal
 */
export function configureTabOps(next: TabOps, apps?: HostApp[]): void {
  ops = next;
  if (apps) registry = apps;
}

/**
 * 取已注入的宿主副作用实现(未初始化属调用时序错误,直接抛错暴露)
 * @returns TabOps 副作用实现
 */
function assertOps(): TabOps {
  if (!ops) throw new Error("[tabs] 尚未 configureTabOps,请先调用 initWujie");
  return ops;
}

/** tabs store 的状态形状(与 TabsSnapshot 持久化结构一致) */
type TabsState = {
  tabs: TabRecord[];
  activeId: string | null;
  seq: number;
};

/** cold Tab 实例化去重锁:同 id 的并发 activate 共享同一在途 promise(nextTick 窗口交错也不重复 start) */
const pendingEnsure = new Map<string, Promise<boolean>>();

/**
 * cold → 实例化。只等到"启动指令已发出",不等待子应用加载完成(不阻塞切 Tab);
 * 同步启动失败时返回 false 并由 onFailed 回滚为 cold,允许用户再次点击重试。
 * @param store tabs store 状态(判据:记录仍在列表才执行创建/回滚)
 * @param tab 待实例化的 Tab 记录(id 为在途去重键)
 * @returns 启动指令是否成功发出(不含子应用加载完成;同步失败为 false)
 */
function ensureForActivate(store: TabsState, tab: TabRecord): Promise<boolean> {
  const existing = pendingEnsure.get(tab.id);
  if (existing) return existing;

  let syncFailed = false;
  const rollback = (error: unknown): void => {
    syncFailed = true;
    console.error(`[tabs] 实例创建失败(${tab.id}):`, error);
    // 记录已被关闭:无需回滚(实例侧已放开判据,下次重开会重建)
    if (!store.tabs.includes(tab)) return;
    tab.state = "cold"; // 回到可重试态(激活 Tab 会显示 ↻)
  };

  const task = (async () => {
    // 等待容器 div 渲染(v-for 随 tabs 更新),再交给 wujie 挂载
    await nextTick();
    // nextTick 窗口内 Tab 可能已被关闭(记录移出列表),放弃创建避免实例悬挂
    if (!store.tabs.includes(tab)) return !syncFailed;
    try {
      assertOps().ensureInstance(tab, rollback);
    } catch (error) {
      rollback(error); // 同步抛错(未注册 app / 容器缺失)
    }
    return !syncFailed;
  })().finally(() => pendingEnsure.delete(tab.id));

  pendingEnsure.set(tab.id, task);
  return task;
}

/**
 * 从 sessionStorage 读取并校验快照;字段缺失/损坏一律视为无历史(不抛出)
 * @returns 合法快照(记录统一落回 cold),无快照或解析失败时返回 null
 */
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

/**
 * S1 恢复态归一化:快照记录可能已被页内导航漂移(身份 id 冻结、page/query 漂移),
 * 把 id 改写为 buildTabKey(app, page, query) 的当前规范值,并对撞车确定性合并。
 *
 * 合并判据(确定性,不可用 lastActivatedAt——快照恢复后恒为 0):
 * 1. id 已等于 canonical 的记录优先保留;
 * 2. 双方均漂移保留 n 较小者(并列取先出现,sort 稳定);
 * 3. 被删记录的 activeId 引用经旧→新映射改指保留者。
 *
 * @param tabs 恢复的快照记录(winner 的 id 就地改写)
 * @param activeId 快照中的激活 id
 * @returns 归一化后的记录列表与激活 id
 */
function normalizeRestoredTabs(
  tabs: TabRecord[],
  activeId: string | null,
): { tabs: TabRecord[]; activeId: string | null } {
  const groups = new Map<string, TabRecord[]>();
  for (const tab of tabs) {
    const canonical = buildTabKey(tab.app, tab.page, tab.query);
    const group = groups.get(canonical);
    if (group) group.push(tab);
    else groups.set(canonical, [tab]);
  }

  const kept: TabRecord[] = [];
  /** 旧 id → 保留记录(含 winner 自身),供 activeId 修正 */
  const ownerOf = new Map<string, TabRecord>();
  for (const [canonical, group] of groups) {
    const winner =
      group.find((tab) => tab.id === canonical) ?? [...group].sort((a, b) => a.n - b.n)[0]!;
    // 先建旧 id 映射再改写 winner.id(winner 漂移时旧 id 仅存在于映射中)
    for (const tab of group) ownerOf.set(tab.id, winner);
    winner.id = canonical;
    kept.push(winner);
  }
  const winnerOfActive = activeId !== null ? ownerOf.get(activeId) : undefined;
  return { tabs: kept, activeId: winnerOfActive ? winnerOfActive.id : activeId };
}

/**
 * Tab 未回报标题时的兜底:注册菜单命中取菜单名,否则取路径末段首字母大写
 * @param app 子应用 key
 * @param page 页面路径
 * @returns 兜底标题(真实名由子应用 tabTitle 回报后覆盖)
 */
function defaultTitle(app: string, page: string): string {
  const entry = registry.find((item) => item.key === app)?.menu.find((menu) => menu.path === page);
  if (entry) return entry.label;
  // 未注册页面(如详情 /product):取末段占位,真实名由子应用 tabTitle 回报
  const segment = page.split("/").filter(Boolean).at(-1) ?? "首页";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * 拼 Tab 的地址栏路径:/app[/page] + query(page 自带 ? 时用 & 续接)
 * @param tab 目标 Tab 记录
 * @returns 用于 history.replaceState 的 URL
 */
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
    /**
     * 有保活实例的 Tab 数(active + background)
     * @param state getter 注入的 store 状态
     * @returns 非 cold 状态的 Tab 数量
     */
    aliveCount(state): number {
      return state.tabs.filter((tab) => tab.state !== "cold").length;
    },
  },

  actions: {
    /**
     * 应用启动:sessionStorage 恢复列表 + 地址栏解析激活 Tab;激活即按需重建实例
     * @param apps 宿主应用注册表(同步保存,供 defaultTitle 兜底查名)
     */
    async init(apps: HostApp[]): Promise<void> {
      registry = apps;
      const saved = loadSnapshot();
      if (saved) {
        // seq 必须覆盖已有 tab.n,避免重建 tab-container-N 撞号
        this.seq = Math.max(saved.seq, ...saved.tabs.map((tab) => tab.n), 0);
        // S1 归一化,必须先于下方 parseTabUrl 匹配:漂移记录(如身份 micro-app-demo|/| 的内容
        // 已漂到 /table)若先参与 URL 匹配,直访 /micro-app-demo 会按旧身份命中僵尸并激活漂移
        // 内容(地址栏被改写为 /micro-app-demo/table),归一化放在匹配之后就修不回去了。
        // 先归一化,URL 按 canonical 匹配不到漂移身份 → 新建干净 Tab 激活。
        const normalized = normalizeRestoredTabs(saved.tabs, saved.activeId);
        this.tabs = normalized.tabs;
        this.activeId = normalized.activeId;
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
      // 不传 requested:S1 已保证恢复态 id === buildTabKey(当前内容),恢复路径数学上
      // 不可达漂移,激活语义与 TabsBar 一致(URL 跟随实例)
      if (this.activeId) await this.activate(this.activeId);
    },

    /**
     * 打开/激活 Tab:确定性去重(同参数复用),cold 先建实例。
     * 激活时携带请求内容 { page, query }:记录内容与请求漂移(页内导航改写了内容)时纠偏。
     * @param app 子应用 key(未注册则报错并忽略)
     * @param page 页面路径
     * @param query 路由查询参数(参与去重键)
     * @param title 可选标题,缺省走 defaultTitle 兜底
     * @returns 本次是否新建了 Tab(去重命中已有 Tab 时为 false,
     *          调用方据此决定是否应用子应用默认布局——无 requested 激活不改变布局;
     *          带 requested 且记录内容与请求漂移时纠偏,此时 created 仍为 false)
     */
    async openTab(
      app: string,
      page: string,
      query?: Record<string, string>,
      title?: string,
    ): Promise<boolean> {
      if (!registry.some((item) => item.key === app)) {
        console.error(`[tabs] 未注册的子应用: ${app}`);
        return false;
      }
      const id = buildTabKey(app, page, query);
      let tab = this.tabs.find((item) => item.id === id);
      const created = !tab;
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
      // 新建记录传参无害(内容恒等,不触发纠偏);命中漂移记录时经 activate 纠偏
      await this.activate(id, { page, query });
      return created;
    },

    /**
     * 子应用 tabOpen 事件入口(带注册表校验)
     * @param payload 子应用上报的开 Tab 载荷
     * @returns 转发给 openTab 的新建标记
     */
    openFromPayload(payload: TabOpenPayload): Promise<boolean> {
      return this.openTab(payload.app, payload.page, payload.query);
    },

    /**
     * 激活 Tab:实例按需重建、地址栏与 sessionStorage 同步、超限触发 LRU 降级。
     * 带 requested 时纠偏:记录内容与请求漂移(页内导航改写了 page/query)则改写记录,
     * 已保活实例经 navigateTab 下发跳回,cold 实例按新内容启动。
     * @param id 目标 Tab 的确定性去重键
     * @param requested 期望的页面内容(openTab 传入;无参调用 URL 跟随实例当前内容,
     *          TabsBar / closeTab 邻居激活等场景语义不变)
     */
    async activate(
      id: string,
      requested?: { page: string; query?: Record<string, string> },
    ): Promise<void> {
      const tab = this.tabs.find((item) => item.id === id);
      if (!tab) {
        console.error(`[tabs] 未知的 Tab: ${id}`);
        return;
      }

      // 同 id 有在途实例化:先等它落定,避免第二个调用方抢先把状态置 active
      const inflight = pendingEnsure.get(id);
      if (inflight) await inflight;

      // S2 纠偏:比较"请求内容 vs 记录当前内容"(复用 buildTabKey 字符串,不手写深比较)。
      // 不能比 tab.id——openTab 命中条件已保证请求 === 身份(身份冻结),恒判等;
      // 页内导航只漂移内容,漂移态下 id ≠ buildTabKey(当前内容),与记录内容比较才有效。
      // background/active 实例经 navigateTab 下发跳转;cold 无实例,下方 ensureInstance
      // 读到改写后的 tab.page 启动,无需额外动作。
      if (
        requested &&
        buildTabKey(tab.app, requested.page, requested.query) !==
          buildTabKey(tab.app, tab.page, tab.query)
      ) {
        tab.page = requested.page;
        tab.query = requested.query;
        if (tab.state !== "cold") assertOps().navigateTab(tab);
      }

      let created = false;
      if (tab.state === "cold") {
        // background 占位:并发 activate 同 id 走 pendingEnsure 合并,实例只建一次
        tab.state = "background";
        const started = await ensureForActivate(this, tab);
        // 等待期间记录被关闭/移出列表:放弃激活,避免把状态写到已移除的记录上
        if (!this.tabs.includes(tab)) return;
        // 同步启动失败已回滚 cold:不进入激活,保留 ↻ 供重试
        if (!started) return;
        created = true;
      }

      const prev = this.activeTab;
      if (prev && prev.id !== id && prev.state === "active") prev.state = "background";

      this.activeId = id;
      tab.state = "active";
      tab.lastActivatedAt = Date.now();

      window.history.replaceState(null, "", mainPath(tab));
      document.title = `无界 MVP · ${tab.title}`;
      this.persist();
      if (created) this.trim();
    },

    /**
     * 关闭 Tab:先同步移除记录再异步销毁;激活 Tab 被关则激活相邻(左优先)
     * @param id 要关闭的 Tab id
     */
    async closeTab(id: string): Promise<void> {
      const index = this.tabs.findIndex((item) => item.id === id);
      if (index < 0) return;
      const wasActive = this.activeId === id;
      const [tab] = this.tabs.splice(index, 1);
      // 记录已移除,销毁期间的重开会走新记录 + 新容器,不与在途 destroy 互踩
      if (tab.state !== "cold") {
        await destroyQuietly(tab);
      }

      // 销毁期间同页被重开(同 id 的新记录):激活权已交给它,不再改成邻居
      if (wasActive && !this.tabs.some((item) => item.id === id)) {
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

    /**
     * 子应用 tabRoute:更新 Tab 记录(身份不变),激活 Tab 同步地址栏
     * @param payload 子应用上报的路由变更载荷
     */
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

    /**
     * 子应用 tabTitle:host 仅信任回报,document.title 跟随激活 Tab(防多实例互抢)
     * @param payload 子应用上报的标题变更载荷
     */
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

    /**
     * 会话结束(登出):销毁全部保活实例并清空列表与本地快照。
     * 登出会卸载业务 shell(tab 容器 DOM 随之移除),保活实例若不销毁将悬挂在
     * 已移除的旧容器上(再登录不重复 init,实例判据仍在 → 激活白屏),故登出即全量销毁;
     * 再登录由 init 重新开场(快照已清,干净工作台)。
     */
    async endSession(): Promise<void> {
      // 先等在途实例化落定(cold→activating 窗口):销毁清单不漏掉刚建好的实例
      await Promise.allSettled([...pendingEnsure.values()]);
      const alive = this.tabs.filter((tab) => tab.state !== "cold");
      this.tabs = [];
      this.activeId = null;
      this.seq = 0;
      sessionStorage.removeItem(TABS_STORAGE_KEY);
      document.title = "无界 MVP · 主应用";
      window.history.replaceState(null, "", "/");
      // 先移记录再销毁(同 closeTab):销毁期间重开 Tab 走新记录 + 新容器,不与在途 destroy 互踩
      for (const tab of alive) await destroyQuietly(tab);
    },

    persist(): void {
      sessionStorage.setItem(
        TABS_STORAGE_KEY,
        JSON.stringify({ tabs: this.tabs, activeId: this.activeId, seq: this.seq }),
      );
    },
  },
});

/**
 * 销毁保活实例并吞掉异常(销毁失败不阻断关闭 / LRU 主流程)
 * @param tab 待销毁的 Tab 记录(传副本定位实例,不依赖原记录存活)
 */
async function destroyQuietly(tab: TabRecord): Promise<void> {
  try {
    await assertOps().destroyInstance({ ...tab });
  } catch (error) {
    console.error(`[tabs] 销毁实例失败(${tab.id}):`, error);
  }
}
