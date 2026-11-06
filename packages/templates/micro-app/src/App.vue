<script setup lang="ts">
import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@repo/store";
import { appConfig } from "./config/app.config";
import { appBus } from "./core/app-bus";

const route = useRoute();
const router = useRouter();

const userStore = useUserStore();

/**
 * 头部导航 active:复刻 RouterLink 前缀匹配语义(to path 为当前 path 前缀即命中,'/' 恒 active)
 * @param path 导航目标 path
 * @returns 当前路由是否命中该导航前缀
 */
function navActive(path: string): boolean {
  return route.path.startsWith(path);
}

/**
 * Tab 内页面标题:应用名 · 命中菜单项 label(path 前缀最长命中,支撑多级 path);
 * 无菜单或未命中时回退应用名
 * @param path 当前路由 path
 * @returns Tab 标题文本
 */
function pageTitle(path: string): string {
  const menu = appConfig.menu ?? [];
  const hit = [...menu]
    .filter((item) => path.startsWith(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit ? `${appConfig.name} · ${hit.label}` : appConfig.name;
}

// 菜单上报:mount 时执行一次;保活实例仅首挂上报,重复上报在 host 侧按 app key 幂等覆盖
if (appConfig.menu) appBus.reportMenu(appConfig.menu);

/** Tab 内导航同步(替代 wujie sync):路由变化上报主应用,标题按菜单前缀匹配回报 */
watch(
  () => [route.path, route.query] as const,
  ([path, query]) => {
    appBus.syncTabRoute(path, query);
    appBus.syncTabTitle(pageTitle(path));
  },
  { immediate: true },
);
</script>

<template>
  <div class="app">
    <header class="header" :style="{ borderColor: appConfig.accent }">
      <span class="logo" :style="{ background: appConfig.accent }" />
      <strong>{{ appConfig.name }}</strong>
      <span class="user">👤 {{ userStore.user.name }}</span>
      <nav>
        <!-- 非锚点导航:wujie shadow 内 <a> href 会被绝对化到子应用 origin,修饰键/中键点击会跳出宿主 -->
        <Button
          v-for="item in appConfig.menu ?? []"
          :key="item.path"
          type="button"
          variant="ghost"
          :class="navActive(item.path) ? 'active' : undefined"
          @click="router.push(item.path)"
        >
          {{ item.label }}
        </Button>
      </nav>
    </header>

    <RouterView />
  </div>
</template>

<style scoped>
.app {
  /* 主题变量由 host 写入 :root(独立运行时 main.ts 自行应用),此处只消费。
     height(非 min-height/100vh):锁定高度链,避免嵌入 host 时撑出容器滚动条 */
  height: 100%;
  background: var(--app-bg-page);
  color: var(--app-text-1);
  transition: background-color 0.2s, color 0.2s;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 2px solid;
  background: var(--app-header-bg);
  transition: background-color 0.2s;
}

.logo {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

nav {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

/* active 态语义:ghost Button 标准外观之上叠加选中色/字重 */
nav button.active {
  color: var(--app-text-1);
  font-weight: 600;
}

.user {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
