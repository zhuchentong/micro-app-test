import { startApp, destroyApp } from "wujie";
import type { Pinia } from "pinia";
import { createHostStoreSync, useThemeStore, useUserStore } from "@repo/store";
import { appEvents } from "@repo/wujie-kit";
import { startTabApp, tabInstanceName } from "@repo/wujie-kit/host";
import { apps } from "./apps";
import { configureTabOps } from "./stores/tabs";

/**
 * 共享依赖注入(仅生产):jsBeforeLoaders 在子应用任何 JS 之前执行,
 * 把 host realm 的 window.__MICRO_SHARED__ 引用传入 iframe 沙箱(同域可达 parent)。
 * dev 不注入:dev 无共享 bundle,子应用走 Vite 预打包依赖,引用保持 undefined 且无读取方。
 */
export const sharedDepsPlugins = import.meta.env.PROD
  ? [
      {
        jsBeforeLoaders: [
          {
            content: [
              "if (window.parent && window.parent.__MICRO_SHARED__) {",
              "  window.__MICRO_SHARED__ = window.parent.__MICRO_SHARED__;",
              "} else {",
              '  console.error("[shared-deps] 主应用未提供 window.__MICRO_SHARED__,子应用共享依赖缺失");',
              "}",
            ].join("\n"),
          },
        ],
      },
    ]
  : undefined;

/** createHostStoreSync 的入参类型(从契约反推,避免与 @repo/store 内部类型耦合) */
type StoreSyncOptions = Parameters<typeof createHostStoreSync>[0];

/** 已启动的保活实例 name → 启动令牌(ensure 幂等判据;刷新后重建,实例名同 id 规则稳定) */
const startedInstances = new Map<string, symbol>();

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

  configureTabOps(
    {
      /**
       * cold → 实例化:一 Tab 一实例(alive 保活 + sync:false,路由由主应用自管)
       * @param tab 目标 Tab 记录(定位实例名与挂载容器)
       * @param onFailed 启动失败回调(含异步失败,store 借此回滚 cold)
       */
      ensureInstance(tab, onFailed) {
        const name = tabInstanceName(tab.app, tab.id);
        if (startedInstances.has(name)) return; // 幂等:重复 activate/双击不重复 start
        // 启动令牌:迟到的旧实例错误不得误删新实例的判据
        const token = Symbol(name);
        startedInstances.set(name, token);
        startTabApp({
          startApp,
          apps,
          startAppPlugins: sharedDepsPlugins,
          baseProps,
          tab: {
            id: tab.id,
            app: tab.app,
            page: tab.page,
            query: tab.query,
            el: `#tab-container-${tab.n}`,
          },
          alive: true,
          onError: (failedTab, url, error) => {
            // 仅释放本次启动的判据:迟到的旧实例错误不得误删新实例
            if (startedInstances.get(name) === token) startedInstances.delete(name);
            onFailed?.(error);
            console.error(`[wujie] Tab(${failedTab.id}) 加载失败: ${url}`, error);
          },
        });
      },
      /**
       * 销毁保活实例(LRU 降级 / 关闭 Tab);先同步失效判据,避免销毁窗口内重开被挡住
       * @param tab 待销毁的 Tab 记录(取 app/id 定位实例名)
       */
      async destroyInstance(tab) {
        const name = tabInstanceName(tab.app, tab.id);
        if (!startedInstances.has(name)) return;
        // wujie 的 sandbox.destroy() 在首个 await 之前就同步 deleteWujieById,
        // 因此这里同步放开判据不会与在途 destroy 抢同一实例;重开走新记录 + 新容器号。
        startedInstances.delete(name);
        try {
          await destroyApp(name);
        } catch (error) {
          console.error(`[wujie] Tab(${tab.id}) 销毁失败:`, error);
        }
      },
      /**
       * 纠偏已保活实例:向对应子应用下发 tabNavigate,令其路由跳到记录当前 page。
       * 未接线子应用无人处理 → 子应用仍经 tabRoute 回报旧页 → 记录回写,
       * 自动退回"记录跟随子应用"旧行为,系统自洽。
       * @param tab 已纠偏的 Tab 记录(取 id/page/query 构造载荷)
       */
      navigateTab(tab) {
        // bus 为 wujie 未导出类型的 EventBus 实例(unknown 入参),断言到最小 $emit 形状
        (bus as { $emit: (event: string, data?: unknown) => void }).$emit(appEvents.tabNavigate, {
          id: tab.id,
          page: tab.page,
          query: tab.query,
        });
      },
    },
    apps,
  );
}
