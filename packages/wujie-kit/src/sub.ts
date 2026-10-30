import { ref } from "vue";
import type { App as VueApp, Ref } from "vue";
import { appEvents } from "./events";
import type { BroadcastPayload } from "./events";
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
  /** 子应用 → 主应用:同步标题 */
  syncTitle(title: string): void;
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
