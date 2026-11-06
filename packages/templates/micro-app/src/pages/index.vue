<script setup lang="ts">
import { useThemeStore, useUserStore } from "@repo/store";

// 实时状态走 store 同步(host:state → 按 rev 判重 → $patch),与主应用保持一致
const userStore = useUserStore();
const themeStore = useThemeStore();
</script>

<template>
  <main class="page">
    <h1>首页</h1>
    <p class="meta">当前用户:{{ userStore.user.name || "—" }} · 主题:{{ themeStore.theme }}</p>
  </main>
</template>

<style scoped>
.page {
  padding: 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 20px;
}

.meta {
  margin: 0;
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
