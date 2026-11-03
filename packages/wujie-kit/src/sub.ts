import { ref } from "vue";
import type { App as VueApp, Ref } from "vue";
import { appEvents } from "./events";
import type {
  BroadcastPayload,
  MenuEntry,
  MenuReportPayload,
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
} from "./events";
import type { HostProps, SubAppConfig } from "./types";

/** 是否运行在 wujie 环境中 */
export function isWujie(): boolean {
  return Boolean(window.__POWERED_BY_WUJIE__);
}

/** 主应用注入的 props(wujie 环境外为 undefined);默认推断为契约类型 HostProps,注入额外字段时用泛型扩展 */
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
  /** 子应用 → 主应用:发送通知 */
  notifyHost(text: string): void;
  /** 子应用 → 主应用:同步标题(单容器模式遗留;Tab 模式用 syncTabTitle) */
  syncTitle(title: string): void;
  /** 子应用 → 主应用:请求打开 Tab(幂等,同参数复用;非 wujie 环境无操作) */
  openTab(page: string, query?: Record<string, string>): void;
  /** 子应用 → 主应用:回报当前 Tab 内路由(替代 sync;query 可直接传 useRoute().query;非 wujie 环境无操作) */
  syncTabRoute(page: string, query?: RouteQuery): void;
  /** 子应用 → 主应用:回报 Tab 标题(host 仅信任激活 Tab;非 wujie 环境无操作) */
  syncTabTitle(title: string): void;
  /** 子应用 → 主应用:上报侧栏菜单(覆盖 host 静态兜底;非 wujie 环境无操作) */
  reportMenu(menu: MenuEntry[]): void;
}

/** 读取注入的 Tab 身份(props 在 startApp 时一次性注入,动态读取避免时序差异) */
function currentTab(): NonNullable<HostProps["tab"]> | null {
  const props =
    typeof window !== "undefined" ? (window.$wujie?.props as HostProps | undefined) : undefined;
  return props?.tab ?? null;
}

/** vue-router 的 query 值形态(结构化匹配,避免本包依赖 vue-router) */
type RouteQuery = Record<string, string | (string | null)[] | null> | undefined;

/** Tab 内 query 上报前的规整(仅保留字符串值,多值 query 取最近一次) */
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
 */
export function createSubBus(config: SubAppConfig): SubBus {
  const lastBroadcast = ref("");
  let broadcastRegistered = false;

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
    notifyHost(text: string): void {
      window.$wujie?.bus?.$emit(appEvents.notify, { from: config.name, text });
    },
    syncTitle(title: string): void {
      window.$wujie?.bus?.$emit(appEvents.title, title);
    },
    openTab(page: string, query?: Record<string, string>): void {
      const tab = currentTab();
      if (!tab) return;
      const payload: TabOpenPayload = { app: tab.app, page, query };
      window.$wujie?.bus?.$emit(appEvents.tabOpen, payload);
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
