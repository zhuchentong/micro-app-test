<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import type {
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
  MenuReportPayload,
} from "@repo/wujie-kit";
import Workbench from "./Workbench.vue";
import TabsBar from "./components/TabsBar.vue";
import { apps } from "./apps";
import { useTabsStore } from "./stores/tabs";
import { useMenuStore } from "./stores/menu";
import { useLayoutStore } from "./stores/layout";
import { useLogsStore } from "./stores/logs";
import { layouts } from "./layouts";

// 主题状态(pinia 已在 main.ts 安装,setup 内直接使用);tabs store 依赖 wujie.ts 先 initWujie
const tabs = useTabsStore();
const menuStore = useMenuStore();
const logs = useLogsStore();
const layoutStore = useLayoutStore();

/** 当前布局条目:current 已在 store 的 loadLayout 白名单校验,必命中注册表 */
const activeLayout = computed(() => layouts[layoutStore.current]);

async function onTabOpen(payload?: TabOpenPayload): Promise<void> {
  if (!payload) return;
  const created = await tabs.openFromPayload(payload);
  // 打开新 Tab 时应用子应用默认布局(去重命中已有 Tab 不改变布局)
  const app = apps.find((item) => item.key === payload.app);
  if (app) layoutStore.applyAppDefault(app.defaultLayout, created);
  logs.add("host", `tab-open ${payload.app} · ${payload.page}`);
}

function onTabRoute(payload?: TabRoutePayload): void {
  if (payload) tabs.applyTabRoute(payload);
}

function onTabTitle(payload?: TabTitlePayload): void {
  if (payload) tabs.applyTabTitle(payload);
}

function onMenuReport(payload?: MenuReportPayload): void {
  if (!payload) return;
  menuStore.applyReport(payload);
  logs.add("host", `菜单上报 ${payload.app} · ${payload.menu.length} 项`);
}

function onNotify(data: { from: string; text: string }): void {
  logs.add(data.from, data.text);
}

onMounted(async () => {
  bus.$on(appEvents.tabOpen, onTabOpen);
  bus.$on(appEvents.tabRoute, onTabRoute);
  bus.$on(appEvents.tabTitle, onTabTitle);
  bus.$on(appEvents.notify, onNotify);
  bus.$on(appEvents.menu, onMenuReport);

  // 启动顺序:子应用实例的 Tab 事件已在事件契约中,listener 先注册再恢复 Tab
  tabs.init(apps);
  // 布局恢复优先级:手动选择(localStorage 持久化)优先;无记录时兜底为激活 Tab 子应用的默认布局
  if (!layoutStore.hasStoredLayout && tabs.activeTab) {
    const restoredApp = apps.find((item) => item.key === tabs.activeTab?.app);
    if (restoredApp) layoutStore.setLayout(restoredApp.defaultLayout);
  }
  logs.add("host", "Tabs 已恢复");
});

onUnmounted(() => {
  bus.$off(appEvents.tabOpen, onTabOpen);
  bus.$off(appEvents.tabRoute, onTabRoute);
  bus.$off(appEvents.tabTitle, onTabTitle);
  bus.$off(appEvents.notify, onNotify);
  bus.$off(appEvents.menu, onMenuReport);
});
</script>

<template>
  <!-- shell--{name} 是未来布局级 shell 几何(grid 等)的扩展点;当前布局差异全在 chrome 层 -->
  <div class="shell" :class="`shell--${layoutStore.current}`">
    <!-- 常驻 chrome:tabs-bar 显隐随布局声明,wujie 容器层(Workbench.pane-area)永不随布局切换卸载/移动 -->
    <TabsBar v-show="activeLayout.meta.showTabsBar" />
    <div class="shell-main">
      <component :is="activeLayout.component" />
      <Workbench />
    </div>
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* 主题变量由 @repo/themes 经 host main.ts 写入 :root,此处只消费(var 经继承穿透到子应用 DOM) */
  background: var(--app-bg-page);
}

.shell-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 12px 16px;
}

/* blank 专注模式:无 chrome,pane 全出血 */
.shell--blank .shell-main {
  padding: 0;
  gap: 0;
}
</style>
