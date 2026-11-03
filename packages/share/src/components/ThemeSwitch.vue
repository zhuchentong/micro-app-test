<script setup lang="ts">
import { computed } from "vue";
import { useThemeStore } from "@repo/store";
import StatusDot from "@repo/share/ui/StatusDot.vue";

/**
 * 业务组件示例:展示 components 层的合法依赖(ui + common + @repo/store)。
 * 消费方(host/子应用)须已安装 pinia 并注册实例。
 */
const themeStore = useThemeStore();
const status = computed(() => (themeStore.theme === "dark" ? "warn" : "ok"));
</script>

<template>
  <button class="theme-switch" @click="themeStore.toggleTheme()">
    <StatusDot :status="status" :label="themeStore.theme" />
    <span>切换主题</span>
  </button>
</template>

<style scoped>
.theme-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
}
</style>
