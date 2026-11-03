<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { useUserStore } from "@repo/store";
import { appConfig } from "./app.config";
import { subBus } from "./bus";

const route = useRoute();

const userStore = useUserStore();

/**
 * Tab 内导航同步(替代 wujie sync):路由变化上报主应用(带 query,身份不变只更新记录);
 * 标题仅对非详情页兜底 —— 详情页标题由 ProductDetail 按真实产品名回报。
 */
watch(
  () => [route.path, route.query] as const,
  ([path, query]) => {
    subBus.syncTabRoute(path, query);

    if (path.startsWith("/product/")) return; // 详情页自报标题
    const name = path === "/about" ? "关于" : path === "/products" ? "产品" : "首页";
    subBus.syncTabTitle(`${appConfig.name} · ${name}`);
  },
  { immediate: true },
);
</script>

<template>
  <div class="app">
    <!-- TODO(tu-design 冒烟):验证通过后删除 -->
    <div
      class="fixed bottom-4 left-4 z-50 flex w-64 flex-col gap-3 rounded-lg border bg-card p-4 shadow-md"
    >
      <p class="text-sm font-medium">tu-design 冒烟(sub-app-a)</p>
      <Button>确认</Button>
      <Input placeholder="focus ring 应跟随主题" />
      <p class="text-xs text-muted-foreground">明暗切换经 host :root 穿透</p>
    </div>
    <header class="header" :style="{ borderColor: appConfig.accent }">
      <span class="logo" :style="{ background: appConfig.accent }" />
      <strong>{{ appConfig.name }}</strong>
      <span class="user">👤 {{ userStore.user.name }}</span>
      <nav>
        <RouterLink :to="{ name: 'home' }">首页</RouterLink>
        <RouterLink :to="{ name: 'about' }">通信演示</RouterLink>
      </nav>
    </header>

    <RouterView />
  </div>
</template>

<style scoped>
.app {
  /* 主题变量由 host 写入 :root(独立运行时 main.ts 自行应用),此处只消费 */
  min-height: 100vh;
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

nav a {
  color: var(--app-text-2);
  text-decoration: none;
  font-size: 14px;
}

nav a.router-link-active {
  color: var(--app-text-1);
  font-weight: 600;
}

.user {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
