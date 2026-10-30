import { startApp, destroyApp } from "wujie";
import type { Pinia } from "pinia";
import { createHostStoreSync, useThemeStore, useUserStore } from "@repo/store";
import { startTabApp, tabInstanceName } from "@repo/wujie-kit/host";
import { apps } from "./apps";
import { configureTabOps } from "./stores/tabs";

/** createHostStoreSync 的入参类型(从契约反推,避免与 @repo/store 内部类型耦合) */
type StoreSyncOptions = Parameters<typeof createHostStoreSync>[0];

/** 已启动的保活实例 name 集合(ensure 幂等判据;刷新后重建,实例名同 id 规则稳定) */
const startedInstances = new Set<string>();

/**
 * 初始化 wujie 主应用:host→子应用状态同步器 + Tab 实例副作用。
 * 须在使用 tabs store 的任何实例操作之前调用(先 configureTabOps 再 init)。
 *
 * @param pinia host 的 pinia 实例
 * @param bus   wujie 导出的 EventBus 实例(wujie 未导出类型声明,边界处按 unknown 透传)
 */
export function initWujie(pinia: Pinia, bus: unknown): void {
  // @repo/store 的 bus 契约与 wujie 的 EventBus 非同一类型声明,此处断言对齐。
  // host 为状态权威源:子应用各自握手(sub:state-request)后经 host:state 广播同步
  createHostStoreSync({ pinia, bus: bus as StoreSyncOptions["bus"] });

  // Tab 模式业务快照:实例化时求值,重建/多开 Tab 均取最新 user/theme
  const baseProps = () => {
    const user = useUserStore(pinia);
    const theme = useThemeStore(pinia);
    return { user: { ...user.user }, theme: theme.theme };
  };

  configureTabOps({
    /** cold → 实例化:一 Tab 一实例(alive 保活 + sync:false,路由由主应用自管) */
    ensureInstance(tab) {
      const name = tabInstanceName(tab.app, tab.id);
      if (startedInstances.has(name)) return; // 幂等:重复 activate/双击不重复 start
      startedInstances.add(name);
      startTabApp({
        startApp,
        apps,
        baseProps,
        tab: {
          id: tab.id,
          app: tab.app,
          page: tab.page,
          query: tab.query,
          el: `#tab-container-${tab.n}`,
        },
        alive: true,
        onError: (_tab, url, error) =>
          console.error(`[wujie] Tab(${tab.id}) 加载失败: ${url}`, error),
      });
    },
    /** 销毁保活实例(LRU 降级 / 关闭 Tab);成功后从判据集合移除,允许后续重建 */
    async destroyInstance(tab) {
      const name = tabInstanceName(tab.app, tab.id);
      if (!startedInstances.has(name)) return;
      await destroyApp(name);
      startedInstances.delete(name);
    },
  });
}
