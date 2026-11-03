<script setup lang="ts">
import { useLayoutStore } from "../stores/layout";
import type { LayoutName } from "../stores/layout";

/** 切换目标与文案由宿主布局声明;外观可用 class 覆盖(父 scoped 样式可命中本组件根元素) */
defineProps<{ target: LayoutName; label: string }>();

const layoutStore = useLayoutStore();
</script>

<template>
  <button class="layout-switch" type="button" @click="layoutStore.setLayout(target)">
    {{ label }}
  </button>
</template>

<style scoped>
/* 中性默认外观:与 sider 内 theme-toggle 同级的次要按钮;布局通过 class 覆盖定位与形状 */
.layout-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-raised);
  color: var(--app-text-1);
  font-size: 13px;
  cursor: pointer;
}

.layout-switch:hover {
  background: var(--app-bg-hover);
}

.layout-switch:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}
</style>
