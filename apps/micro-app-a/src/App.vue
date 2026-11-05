<script setup lang="ts">
import { watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@repo/store";
import { appConfig } from "./app.config";
import { subBus } from "./bus";

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

// 菜单上报:mount 时执行一次;保活实例仅首挂上报,重复上报在 host 侧按 app key 幂等覆盖
if (appConfig.menu) subBus.reportMenu(appConfig.menu);

/**
 * Tab 内导航同步(替代 wujie sync):路由变化上报主应用(带 query,身份不变只更新记录);
 * 标题仅对非详情页兜底 —— 详情页标题由 ProductDetail 按真实产品名回报。
 */
watch(
  () => [route.path, route.query] as const,
  ([path, query]) => {
    subBus.syncTabRoute(path, query);

    if (path.startsWith("/products/")) return; // 详情页自报标题
    const name = path === "/about" ? "关于" : path === "/products" ? "产品" : "首页";
    subBus.syncTabTitle(`${appConfig.name} · ${name}`);
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
        <button
          type="button"
          :class="{ active: navActive('/') }"
          @click="router.push({ name: 'home' })"
        >
          首页
        </button>
        <button
          type="button"
          :class="{ active: navActive('/about') }"
          @click="router.push({ name: 'about' })"
        >
          通信演示
        </button>
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

nav button {
  color: var(--app-text-2);
  font-size: 14px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

nav button.active {
  color: var(--app-text-1);
  font-weight: 600;
}

.user {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
