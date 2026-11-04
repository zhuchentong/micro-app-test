import { defineStore } from "pinia";
import type { MenuEntry, MenuReportPayload } from "@repo/wujie-kit";
import { apps } from "../apps";

/**
 * 侧栏菜单 store:子应用经 sub:menu 上报后覆盖静态注册表兜底。
 * 静态注册是 Tab 未实例化时的兜底(实例加载前菜单不可知);上报按 app key 幂等覆盖,
 * 保活实例重复上报、非保活 remount 重报均安全。
 */
export const useMenuStore = defineStore("menu", {
  state: () => ({ reported: {} as Record<string, MenuEntry[]> }),
  getters: {
    /**
     * 指定子应用的菜单:上报覆盖兜底,未注册 app 返回空(不渲染)
     * @param state getter 注入的 store 状态
     * @returns 菜单选择器:传入 appKey 返回其菜单项(上报优先,注册表兜底,均无则空数组)
     */
    menuFor(state) {
      return (appKey: string): MenuEntry[] =>
        state.reported[appKey] ?? apps.find((app) => app.key === appKey)?.menu ?? [];
    },
  },
  actions: {
    /**
     * 子应用 sub:menu 入口(带注册表校验)
     * @param payload 子应用上报的菜单载荷(app 须已注册)
     */
    applyReport(payload: MenuReportPayload): void {
      if (!apps.some((app) => app.key === payload.app)) {
        console.error(`[menu] 未注册的子应用菜单上报: ${payload.app}`);
        return;
      }
      this.reported[payload.app] = payload.menu;
    },
  },
});
