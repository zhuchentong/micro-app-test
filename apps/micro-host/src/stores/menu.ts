import { defineStore } from "pinia";
import type { MenuGroup, MenuReportPayload } from "@repo/wujie-kit";
import { apps } from "../apps";

/**
 * 菜单上报形状防御:分组菜单(MenuGroup[])必须为数组,且每组带非空 label 与数组 children。
 * bus payload 来自子应用沙箱,不受 TS 静态约束兜底——坏形状若直接落盘会把侧栏渲染炸成
 * 运行时错误,故入口处统一拒绝(维持幂等覆盖语义:非法上报不写入,兜底/上次有效值保持不变)。
 * @param menu 待校验的上报菜单
 * @returns 形状合法返回 true
 */
function isValidMenuShape(menu: unknown): menu is MenuGroup[] {
  return (
    Array.isArray(menu) &&
    menu.every(
      (group) =>
        typeof group?.label === "string" && group.label.length > 0 && Array.isArray(group.children),
    )
  );
}

/**
 * 侧栏菜单 store:子应用经 sub:menu 上报后覆盖静态注册表兜底。
 * 静态注册是 Tab 未实例化时的兜底(实例加载前菜单不可知);上报按 app key 幂等覆盖,
 * 保活实例重复上报、非保活 remount 重报均安全。
 */
export const useMenuStore = defineStore("menu", {
  state: () => ({ reported: {} as Record<string, MenuGroup[]> }),
  getters: {
    /**
     * 指定子应用的菜单:上报覆盖兜底,未注册 app 返回空(不渲染)
     * @param state getter 注入的 store 状态
     * @returns 菜单选择器:传入 appKey 返回其菜单分组(上报优先,注册表兜底,均无则空数组)
     */
    menuFor(state) {
      return (appKey: string): MenuGroup[] =>
        state.reported[appKey] ?? apps.find((app) => app.key === appKey)?.menu ?? [];
    },
  },
  actions: {
    /**
     * 子应用 sub:menu 入口(带注册表校验与上报形状防御)
     * @param payload 子应用上报的菜单载荷(app 须已注册,menu 须为合法分组形状)
     */
    applyReport(payload: MenuReportPayload): void {
      if (!apps.some((app) => app.key === payload.app)) {
        console.error(`[menu] 未注册的子应用菜单上报: ${payload.app}`);
        return;
      }
      if (!isValidMenuShape(payload.menu)) {
        console.error("[menu] 忽略非法的菜单上报形状:", payload.app);
        return;
      }
      this.reported[payload.app] = payload.menu;
    },
  },
});
