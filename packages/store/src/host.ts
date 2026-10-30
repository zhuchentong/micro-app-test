import { watch } from "vue";
import type { Pinia } from "pinia";
import { appEvents } from "@repo/wujie-kit";
import type { HostStatePayload } from "@repo/wujie-kit";
import { useThemeStore } from "./stores/theme";
import { useUserStore } from "./stores/user";

/** host 侧最小 bus 结构接口(wujie 导出的 bus 结构兼容,必要时由调用方断言) */
export interface SyncBus {
  $emit(event: string, data?: unknown): void;
  $on<T = unknown>(event: string, callback: (data?: T) => void): void;
  $off(event: string, callback?: (data?: unknown) => void): void;
}

/** host 侧同步器句柄:手动 + 自动广播状态快照 */
export interface HostStoreSync {
  /** 手动广播一次快照(host 在 startApp 后补发) */
  emitSnapshot(): void;
  /** 停止自动广播(卸载 host 时调用) */
  stop(): void;
}

/** 快照序号:单调递增,子应用据此丢弃过期/乱序事件 */
let rev = 0;

/** 创建 host 侧 store 同步:store 变更经 bus 广播给子应用(创建时不自动发快照) */
export function createHostStoreSync(options: { pinia: Pinia; bus: SyncBus }): HostStoreSync {
  const { bus } = options;
  const theme = useThemeStore(options.pinia);
  const user = useUserStore(options.pinia);

  function emitSnapshot(): void {
    bus.$emit(appEvents.state, {
      user: { ...user.user },
      theme: theme.theme,
      rev: ++rev,
    } satisfies HostStatePayload);
  }

  // 自动广播:任一共享 store 变更即发快照(emitSnapshot 不改 store,无回环风险)
  const stopWatch = watch(
    () => ({ user: { ...user.user }, theme: theme.theme }),
    () => emitSnapshot(),
  );

  // 握手:子应用注册监听后发 sub:state-request,host 即时回发当前全量快照。
  // 初始同步不依赖 host 启动时的主动广播 —— 那会在子应用尚未订阅时发进空气。
  function onRequest(): void {
    emitSnapshot();
  }
  bus.$on(appEvents.stateRequest, onRequest);

  return {
    emitSnapshot,
    stop: () => {
      stopWatch();
      bus.$off(appEvents.stateRequest, onRequest);
    },
  };
}
