import type { Component } from "vue";
import BlankLayout from "./blank.vue";
import WorkspaceLayout from "./workspace.vue";
import type { LayoutName } from "../stores/layout";

/**
 * 布局声明元数据:常驻 chrome 层(TabsBar/Workbench)按此调整自身,App.vue 不感知具体布局语义。
 * meta 集中在注册表而非各 SFC(SFC 命名导出不进 vue-tsc 的 *.vue 类型垫片,无法安全 import)。
 */
export interface LayoutMeta {
  /** 是否显示常驻 tabs-bar */
  showTabsBar: boolean;
  /** 是否显示面包屑 */
  showBreadcrumb: boolean;
  /** pane-stage 是否带单层衬底卡(设计稿 node 91:114;子应用 DefaultLayout 卡坐落于留白区) */
  framed: boolean;
}

export interface LayoutEntry {
  component: Component;
  meta: LayoutMeta;
}

/**
 * 布局注册表:key 必须覆盖 stores/layout.ts 白名单的每个 LayoutName
 * (Record 类型强制:白名单加名而未注册会直接编译报错)。
 * 新增布局 = 新建 xxx.vue(chrome 样式)+ 此处注册一行,App.vue 零改动。
 */
export const layouts: Record<LayoutName, LayoutEntry> = {
  // workspace:工作台,图标导航 + tabs-bar + 面包屑 + 单层衬底卡
  workspace: {
    component: WorkspaceLayout,
    meta: { showTabsBar: true, showBreadcrumb: true, framed: true },
  },
  // blank:专注模式,无 chrome,pane 全屏 + 浮动返回按钮
  blank: {
    component: BlankLayout,
    meta: { showTabsBar: false, showBreadcrumb: false, framed: false },
  },
};
