<script setup lang="ts">
defineOptions({ name: "BlankLayout" });
import LayoutSwitchButton from "../components/LayoutSwitchButton.vue";
</script>

<template>
  <!-- 布局无 chrome 容器:浮动返回按钮直接 absolute 定位到 shell(根元素不占文档流) -->
  <LayoutSwitchButton class="fab" label="返回工作台" target="workspace" />
</template>

<style scoped>
/* 父 scoped 样式命中子组件根元素:覆盖 LayoutSwitchButton 中性默认样式为浮动按钮 */
.fab {
  position: absolute;
  right: 20px;
  bottom: 20px;
  padding: 10px 16px;
  border: 1px solid var(--app-accent-soft-border);
  border-radius: 999px;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}

.fab:hover {
  background: var(--app-accent);
  filter: brightness(1.08);
}
</style>
