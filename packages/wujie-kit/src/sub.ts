import { ref } from "vue";
import type { App as VueApp, Ref } from "vue";
import { appEvents } from "./events";
import type {
  AuthLoginPayload,
  BroadcastPayload,
  MenuEntry,
  MenuReportPayload,
  TabNavigatePayload,
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
} from "./events";
import type { HostProps, SubAppConfig } from "./types";

/**
 * 是否运行在 wujie 环境中
 * @returns 嵌入主应用运行时 true;独立直访(未经过 wujie 注入)时 false
 */
export function isWujie(): boolean {
  return Boolean(window.__POWERED_BY_WUJIE__);
}

/**
 * 主应用注入的 props(wujie 环境外为 undefined);默认推断为契约类型 HostProps,注入额外字段时用泛型扩展
 * @returns 注入的 props 对象;非 wujie 环境(含 node 测试环境)返回 undefined
 */
export function useHostProps<T = HostProps>(): T | undefined {
  // 守卫 typeof window:node 测试环境无 window,直接引用会 ReferenceError
  return typeof window !== "undefined" ? (window.$wujie?.props as T | undefined) : undefined;
}

/** 子应用 bus 能力集合 */
export interface SubBus {
  /** 主应用最近一次广播内容(模块级单例状态) */
  lastBroadcast: Ref<string>;
  /** 注册广播监听(内部幂等,避免 remount 重复注册) */
  registerBroadcastListener(): void;
  /**
   * 注册 host→child 的 Tab 纠偏导航监听(host:tab-navigate)。
   * host 纠偏漂移记录后,已保活实例经此按载荷 (page, query) 跳转路由,内容回到记录身份。
   * 内部幂等(重复注册只挂一个监听);payload 定向过滤本 Tab;非 wujie 环境无操作。
   */
  registerTabNavigateHandler(handler: (page: string, query?: Record<string, string>) => void): void;
  /** 子应用 → 主应用:发送通知 */
  notifyHost(text: string): void;
  /** 子应用 → 主应用:同步标题(单容器模式遗留;Tab 模式用 syncTabTitle) */
  syncTitle(title: string): void;
  /**
   * 子应用 → 主应用:请求打开 Tab(幂等,同参数复用;tabOpen 事件 fire-and-forget)
   * @returns true = 已向宿主发出请求;false = 未嵌入宿主(无 Tab 身份),调用方可回退本地路由
   */
  openTab(page: string, query?: Record<string, string>): boolean;
  /** 子应用 → 主应用:回报当前 Tab 内路由(替代 sync;query 可直接传 useRoute().query;非 wujie 环境无操作) */
  syncTabRoute(page: string, query?: RouteQuery): void;
  /** 子应用 → 主应用:回报 Tab 标题(host 仅信任激活 Tab;非 wujie 环境无操作) */
  syncTabTitle(title: string): void;
  /** 子应用 → 主应用:上报侧栏菜单(覆盖 host 静态兜底;非 wujie 环境无操作) */
  reportMenu(menu: MenuEntry[]): void;
  /** 子应用 → 主应用:登录成功上报(授权网关校验通过;非 wujie 环境无操作) */
  reportLogin(user: { id: string; name: string }): void;
}

/**
 * 读取注入的 Tab 身份(props 在 startApp 时一次性注入,动态读取避免时序差异)
 * @returns 当前 Tab 身份;非 wujie 环境或未注入 tab 时返回 null
 */
function currentTab(): NonNullable<HostProps["tab"]> | null {
  const props =
    typeof window !== "undefined" ? (window.$wujie?.props as HostProps | undefined) : undefined;
  return props?.tab ?? null;
}

/** vue-router 的 query 值形态(结构化匹配,避免本包依赖 vue-router) */
export type RouteQuery = Record<string, string | (string | null)[] | null> | undefined;

/**
 * Tab 内 query 上报前的规整(仅保留字符串值,多值 query 取最近一次)
 * @param query vue-router 形态的 query(值可为字符串数组或 null)
 * @returns 规整后的纯字符串映射;入参为空或规整后无条目时返回 undefined
 */
function normalizeQuery(query: RouteQuery): Record<string, string> | undefined {
  if (!query) return undefined;
  const entries = Object.entries(query).map(([key, value]): [string, string] => [
    key,
    Array.isArray(value) ? String(value.at(-1) ?? "") : String(value ?? ""),
  ]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * 创建子应用 bus 能力。
 * 注意:请在应用内以组合根方式调用一次(如 src/bus.ts)并共享该实例,
 * 避免多个实例各自维护 lastBroadcast / 重复注册监听。
 * @param config 子应用配置(至少提供 name 作为消息来源标识)
 * @returns SubBus 能力集合(含响应式 lastBroadcast 与各事件发送方法)
 */
export function createSubBus(config: SubAppConfig): SubBus {
  const lastBroadcast = ref("");
  let broadcastRegistered = false;
  let tabNavigateRegistered = false;

  return {
    lastBroadcast,
    registerBroadcastListener(): void {
      if (broadcastRegistered) return;
      window.$wujie?.bus?.$on(appEvents.broadcast, (data?: BroadcastPayload) => {
        // 定向广播:与本实例 Tab 无关的消息直接丢弃(多实例保活下全实例都在监听)
        const myTabId = currentTab()?.id;
        if (data?.target && myTabId && data.target !== myTabId) return;
        lastBroadcast.value = data?.text ?? "";
      });
      broadcastRegistered = true;
    },
    registerTabNavigateHandler(
      handler: (page: string, query?: Record<string, string>) => void,
    ): void {
      if (tabNavigateRegistered) return;
      // 非 wujie 环境(独立直访/node 测试)无 bus:直接返回,不锁定幂等标志
      const bus = window.$wujie?.bus;
      if (!bus) return;
      bus.$on(appEvents.tabNavigate, (payload?: TabNavigatePayload) => {
        // 定向过滤:仅本 Tab 的纠偏生效(多实例保活下全实例都在监听)
        if (!payload || payload.id !== currentTab()?.id) return;
        handler(payload.page, payload.query);
      });
      tabNavigateRegistered = true;
    },
    notifyHost(text: string): void {
      window.$wujie?.bus?.$emit(appEvents.notify, { from: config.name, text });
    },
    syncTitle(title: string): void {
      window.$wujie?.bus?.$emit(appEvents.title, title);
    },
    openTab(page: string, query?: Record<string, string>): boolean {
      const tab = currentTab();
      if (!tab) return false;
      const payload: TabOpenPayload = { app: tab.app, page, query };
      window.$wujie?.bus?.$emit(appEvents.tabOpen, payload);
      return true;
    },
    syncTabRoute(page: string, query?: RouteQuery): void {
      const tab = currentTab();
      if (!tab) return;
      const payload: TabRoutePayload = { id: tab.id, page, query: normalizeQuery(query) };
      window.$wujie?.bus?.$emit(appEvents.tabRoute, payload);
    },
    syncTabTitle(title: string): void {
      const tab = currentTab();
      if (!tab) return;
      const payload: TabTitlePayload = { id: tab.id, title };
      window.$wujie?.bus?.$emit(appEvents.tabTitle, payload);
    },
    reportMenu(menu: MenuEntry[]): void {
      const tab = currentTab();
      if (!tab) return;
      const payload: MenuReportPayload = { app: tab.app, menu };
      window.$wujie?.bus?.$emit(appEvents.menu, payload);
    },
    reportLogin(user: { id: string; name: string }): void {
      const payload: AuthLoginPayload = { user: { ...user } };
      window.$wujie?.bus?.$emit(appEvents.authLogin, payload);
    },
  };
}

/** 最小 router 形状(结构化匹配,保持本包不依赖 vue-router,同 RouteQuery 先例) */
export interface SubRouter {
  push(location: { path: string; query?: RouteQuery }): unknown;
}

/** createAppBus 产物:页面导航入口 + 底层 bus 能力集合 */
export interface SubAppBus {
  subBus: SubBus;
  /**
   * 页面导航入口:请求宿主开新 Tab(幂等,同参数复用);未嵌入宿主(独立直访/无 Tab 身份)
   * 时回退本应用内路由。列表页打开实体用本方法;当前 Tab 内续跳直接用 router.push。
   */
  openTab(page: string, query?: Record<string, string>): void;
}

/**
 * 子应用 bus 组合根工厂:单例 bus + host 纠偏接线(有 router 时) + 导航约定。
 * 每个 app 在 src/bus.ts 以模块级单例调用一次(页面共享同一 lastBroadcast 与监听状态),
 * 解构导出 subBus 与 openTab 供页面使用。
 * @param config 子应用配置(至少提供 name 作为消息来源标识)
 * @param router 应用 vue-router 实例(结构化按 SubRouter 匹配);缺省时不接纠偏、回退无效
 * @returns SubAppBus
 */
export function createAppBus(config: SubAppConfig, router?: SubRouter): SubAppBus {
  const subBus = createSubBus(config);
  if (router) {
    // host 纠偏漂移 Tab 时(host:tab-navigate),按载荷跳路由,内容回到记录身份
    subBus.registerTabNavigateHandler((page, query) => void router.push({ path: page, query }));
  }
  return {
    subBus,
    openTab(page, query) {
      if (subBus.openTab(page, query)) return; // 已向宿主发出开 Tab 请求
      if (router) void router.push({ path: page, query }); // 未嵌入宿主:页内回退
    },
  };
}

/**
 * 子应用挂载入口:统一处理 wujie 生命周期与独立运行 fallback。
 *
 * wujie 2.x 运行模式语义(见 skills/wujie references/modes.md):
 * - 保活模式(alive:true):切走不调 __WUJIE_UNMOUNT、不清 DOM,切回 sandbox.mount()
 *   因 mountFlag 直接返回 —— 实例与状态天然保留,本函数的 MOUNT 仅首次执行;
 * - 单例/重建模式(alive 缺省):切走会调 __WUJIE_UNMOUNT 并清空 shadow DOM,
 *   Vue 3 app 实例 unmount 后不可 remount("App has already been mounted"),
 *   因此 UNMOUNT 必须置空实例,MOUNT 每次创建新实例。
 * @param create   创建 Vue 应用实例的工厂(MOUNT 时调用;重建模式下每次新建)
 * @param selector 挂载目标选择器,默认 "#app"
 */
export function mountWujieApp(create: () => VueApp, selector = "#app"): void {
  if (window.__POWERED_BY_WUJIE__ && window.__WUJIE) {
    assertSharedVersions();
    let appInstance: VueApp | null = null;

    window.__WUJIE_MOUNT = () => {
      appInstance = appInstance ?? create();
      appInstance.mount(selector);
    };

    window.__WUJIE_UNMOUNT = () => {
      appInstance?.unmount();
      // Vue app 不支持 remount:销毁后置空,保证下次 MOUNT 创建新实例
      appInstance = null;
    };

    window.__WUJIE.mount();
  } else {
    // 独立运行(直接访问子应用端口)
    create().mount(selector);
  }
}

/** 共享依赖版本漂移检查(仅嵌入模式):子应用构建期期望版本 vs host 提供的 window.__MICRO_SHARED__ */
function assertSharedVersions(): void {
  // 工厂未注入构建期期望(旧产物/独立构建)时跳过;共享 bundle 缺失由 host 侧 jsBeforeLoaders 兜底告警
  if (typeof __MICRO_SHARED_VERSIONS__ === "undefined") return;
  const actual = window.__MICRO_SHARED__?.version;
  if (!actual) return;
  const expected = __MICRO_SHARED_VERSIONS__;
  // 清单以构建期注入的 expected 为准动态比对,避免在此处二次硬编码共享依赖列表
  const drifted = Object.entries(expected)
    .filter(([key, expectedVersion]) => actual[key as keyof typeof actual] !== expectedVersion)
    .map(([key]) => key);
  if (drifted.length > 0) {
    console.error(
      `[shared-deps] 共享依赖版本漂移(差异: ${drifted.join(", ")}): 期望 ${JSON.stringify(expected)} vs 实际 ${JSON.stringify(actual)}`,
    );
  }
}
