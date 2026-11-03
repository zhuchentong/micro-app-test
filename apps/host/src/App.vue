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

function onTabOpen(payload?: TabOpenPayload): void {
  if (!payload) return;
  tabs.openFromPayload(payload);
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
    <component :is="activeLayout.component" />
    <!-- 常驻内容层:tabs-bar 显隐随布局声明,wujie 容器层永不随布局切换卸载/移动 -->
    <Workbench :show-tabs-bar="activeLayout.meta.showTabsBar" />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  display: flex;
  height: 100vh;
  /* 主题变量由 @repo/themes 经 host main.ts 写入 :root,此处只消费(var 经继承穿透到子应用 DOM) */
  background: var(--app-bg-page);
}
</style>
