import { watch } from "vue";
import type { Pinia } from "pinia";
import { appEvents } from "@repo/wujie-kit";
import type { HostStatePayload, SyncBus } from "@repo/wujie-kit";
import { useThemeStore } from "./stores/theme";
import { useUserStore } from "./stores/user";

/** host 侧 bus 结构契约(单一来源在 @repo/wujie-kit,此处 re-export 保持包公共 API 不变) */
export type { SyncBus };

/** host 侧同步器句柄:手动 + 自动广播状态快照 */
export interface HostStoreSync {
  /** 手动广播一次快照(host 在 startApp 后补发) */
  emitSnapshot(): void;
  /** 停止自动广播(卸载 host 时调用) */
  stop(): void;
}

/** 快照序号:单调递增,子应用据此丢弃过期/乱序事件 */
let rev = 0;

/**
 * 创建 host 侧 store 同步:store 变更经 bus 广播给子应用(创建时不自动发快照)。
 * @param options pinia 实例与同步 bus(共享 store 的变更源与广播通道)
 * @returns 同步器句柄:emitSnapshot 手动补发快照,stop 停止自动广播并解除握手监听
 */
export function createHostStoreSync(options: { pinia: Pinia; bus: SyncBus }): HostStoreSync {
  const { bus } = options;
  const theme = useThemeStore(options.pinia);
  const user = useUserStore(options.pinia);

  function emitSnapshot(): void {
    bus.$emit(appEvents.state, {
      user: { ...user.user },
      theme: theme.theme,
      custom: { ...theme.custom },
      rev: ++rev,
    } satisfies HostStatePayload);
  }

  // 自动广播:任一共享 store 变更即发快照(emitSnapshot 不改 store,无回环风险)。
  // custom 引用在 setCustom 中整体替换,浅拷贝进 watch 源即可感知变更
  const stopWatch = watch(
    () => ({ user: { ...user.user }, theme: theme.theme, custom: { ...theme.custom } }),
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
