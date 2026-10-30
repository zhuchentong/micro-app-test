<script setup lang="ts">
import { watch } from "vue";
import { useRoute } from "vue-router";
import { useThemeStore, useUserStore } from "@repo/store";
import { appConfig } from "./app.config";
import { subBus } from "./bus";

const route = useRoute();

const themeStore = useThemeStore();
const userStore = useUserStore();

/** 路由变化时向主应用同步标题(bus → host:title) */
watch(
  () => route.path,
  (path) => {
    const name = path === "/about" ? "关于" : "首页";
    subBus.syncTitle(`${appConfig.name} · ${name}`);
  },
  { immediate: true },
);
</script>

<template>
  <div class="app" :data-theme="themeStore.theme">
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
  /* 主题变量:默认亮色,[data-theme] 切换;页面/卡片/控件经 var() 继承,整页随主题变化 */
  --sub-header-bg: #ffffff;
  --sub-bg: #ffffff;
  --sub-surface: #ffffff;
  --sub-text: #111827;
  --sub-muted: #6b7280;
  --sub-faint: #9ca3af;
  --sub-border: #e5e7eb;
  --sub-hover: #f3f4f6;

  min-height: 100vh;
  background: var(--sub-bg);
  color: var(--sub-text);
  transition: background-color 0.2s, color 0.2s;
}

/* 暗色覆盖:与 host 暗色同一色系 */
.app[data-theme="dark"] {
  --sub-header-bg: #111827;
  --sub-bg: #0b1220;
  --sub-surface: #1f2937;
  --sub-text: #f9fafb;
  --sub-muted: #9ca3af;
  --sub-faint: #6b7280;
  --sub-border: #374151;
  --sub-hover: #374151;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 2px solid;
  background: var(--sub-header-bg);
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
  color: var(--sub-muted);
  text-decoration: none;
  font-size: 14px;
}

nav a.router-link-active {
  color: var(--sub-text);
  font-weight: 600;
}

.user {
  font-size: 14px;
  color: var(--sub-muted);
}
</style>
