import type { Pinia } from "pinia";
import { appEvents } from "@repo/wujie-kit";
import type { HostStatePayload, SyncBus } from "@repo/wujie-kit";
import { useHostProps } from "@repo/wujie-kit/sub";
import { useThemeStore } from "./stores/theme";
import { useUserStore } from "./stores/user";

/** sub 侧同步器句柄 */
export interface SubStoreSync {
  /** 从 props 水合并注册快照监听(幂等) */
  register(): void;
  /** 注销快照监听(非保活 remount 时清理) */
  dispose(): void;
}

/**
 * 创建子应用侧 store 同步:host:state 快照单向写入本地 pinia 副本。
 * 非 wujie 独立运行(无 bus 无 props)时自然 no-op。
 */
export function createSubStoreSync(options: { pinia: Pinia; bus?: SyncBus }): SubStoreSync {
  const themeStore = useThemeStore(options.pinia);
  const userStore = useUserStore(options.pinia);

  // 测试环境(node)无 window,必须守卫
  const bus = options.bus ?? (typeof window !== "undefined" ? window.$wujie?.bus : undefined);

  let registered = false;
  /** 最近应用的快照序号,丢弃过期/乱序事件 */
  let lastRev = 0;

  // 入参按 unknown 接收以匹配 bus.$off 的回调签名,内部按事件契约收窄为 HostStatePayload
  function handler(data?: unknown): void {
    const payload = data as HostStatePayload | undefined;
    if (!payload || payload.rev <= lastRev) return;
    lastRev = payload.rev;
    userStore.setUser({ ...payload.user });
    themeStore.setTheme(payload.theme);
  }

  return {
    register(): void {
      // 幂等:避免 remount / 重复调用导致重复注册
      if (registered) return;
      registered = true;

      // 先从 startApp 注入的 props 水合初始状态(经 useHostProps 走强类型契约)
      if (typeof window !== "undefined") {
        const props = useHostProps();
        if (props?.theme) themeStore.setTheme(props.theme);
        if (props?.user) userStore.setUser({ ...props.user });
      }
      // 水合来自权威源,本地序号归零
      lastRev = 0;

      // 有 bus 才注册监听;无 bus(独立运行)为 no-op
      bus?.$on(appEvents.state, handler);
      // 握手:向 host 请求当前快照。注册动作本身保证此后 host 的回发必有订阅者接收,
      // 避免 host 启动早期(子应用尚未加载完成)发出的广播被错过
      bus?.$emit(appEvents.stateRequest);
    },
    dispose(): void {
      bus?.$off(appEvents.state, handler);
    },
  };
}
