import { startApp } from "wujie";
import type { Pinia } from "pinia";
import { createMicroAppStarter } from "@repo/wujie-kit/host";
import { parseLocation as parseSyncLocation } from "@repo/wujie-kit/host";
import type { HostProps } from "@repo/wujie-kit";
import { createHostStoreSync, useThemeStore, useUserStore } from "@repo/store";
import { apps } from "./apps";

export type { HostProps };

/** createHostStoreSync 的入参类型(从契约反推,避免与 @repo/store 内部类型耦合) */
type StoreSyncOptions = Parameters<typeof createHostStoreSync>[0];

/** 子应用启动器,initWujie 成功后才有值 */
let starter: ((key: string, path?: string) => void) | null = null;

/**
 * 初始化 wujie 主应用:创建 host→子应用的状态同步器与子应用启动器。
 * 须在首次 startMicroApp 之前调用;props 改为函数形式,每次启动时实时读取 pinia 快照。
 *
 * @param pinia host 的 pinia 实例
 * @param bus   wujie 导出的 EventBus 实例(wujie 未导出对应类型声明,边界处按 unknown 透传)
 */
export function initWujie(pinia: Pinia, bus: unknown): void {
  // @repo/store 的 bus 契约与 wujie 的 EventBus 非同一类型声明,此处断言对齐。
  // 不取返回值:创建即完成握手监听注册,后续变更广播由 watch 自动完成
  createHostStoreSync({ pinia, bus: bus as StoreSyncOptions["bus"] });

  starter = createMicroAppStarter({
    startApp,
    apps,
    // 每次启动子应用时求值,保证子应用拿到的是最新用户与主题状态
    props: () => {
      const user = useUserStore(pinia);
      const theme = useThemeStore(pinia);
      return { user: { ...user.user }, theme: theme.theme };
    },
    el: "#app-container",
    alive: true,
    // 初始同步不做启动时主动广播:子应用注册监听后会经 sub:state-request 握手请求快照,
    // host 收到即回发,避免子应用尚未订阅时发出的广播被 wujie 警告"事件订阅数量为空"
  });
}

/** 启动子应用(sync 路由同步 + alive 保活:切换保留子应用状态) */
export function startMicroApp(key: string, path?: string): void {
  if (!starter) {
    console.error("[wujie] 尚未初始化,请先调用 initWujie(pinia, bus)");
    return;
  }
  starter(key, path);
}

/** 解析 wujie sync 写入的 ?{appKey}={path} 参数,恢复目标子应用与路由 */
export function parseLocation() {
  return parseSyncLocation(location.search, apps);
}
