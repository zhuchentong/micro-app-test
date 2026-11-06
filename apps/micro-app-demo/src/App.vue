<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { appConfig } from "./app.config";
import { subBus } from "./bus";

const route = useRoute();

// 菜单上报:mount 时执行一次;保活实例仅首挂上报,重复上报在 host 侧按 app key 幂等覆盖
if (appConfig.menu) subBus.reportMenu(appConfig.menu);

/**
 * Tab 内页面标题:应用名 · menu 前缀最长命中(详情页等动态标题由页面自行上报覆盖)
 * @param path 当前路由路径
 * @returns Tab 标题文本
 */
function pageTitle(path: string): string {
  const menu = appConfig.menu ?? [];
  const hit = [...menu]
    .filter((item) => path.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit ? hit.label : "首页";
}

/** Tab 内导航同步(替代 wujie sync):路由变化上报主应用,标题走 tab 契约 */
watch(
  () => [route.path, route.query] as const,
  ([path, query]) => {
    subBus.syncTabRoute(path, query);
    subBus.syncTabTitle(`${appConfig.name} · ${pageTitle(path)}`);
  },
  { immediate: true },
);
</script>

<template>
  <div class="app">
    <RouterView />
  </div>
</template>

<style scoped>
.app {
  /* 子应用 = 纯内容片段:无 header/chrome(导航与身份由 host 提供),只渲染布局内容区。
     根透明:嵌入 host 时露出衬底卡(--app-bg-substrate),页面白卡由布局组件承担;
     独立运行时浏览器默认底透出。
     height(非 min-height/100vh):锁定高度链,布局组件的 height:100% 才有确定父高,
     table/form 填充布局不会撑出 tab-pane 滚动条 */
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  color: var(--app-text-1);
}
</style>
