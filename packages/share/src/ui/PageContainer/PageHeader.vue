<script setup lang="ts">
/**
 * 页面标题区:PageContainer 各布局共用的小节头(标题 + 可选描述 + 右侧操作区)。
 * 仅 PageContainer 内部使用,不对外导出。
 */
defineOptions({ name: "PageContainerHeader" });

withDefaults(defineProps<{ title?: string }>(), { title: "" });
</script>

<template>
  <header class="pc-header">
    <div class="pc-main">
      <h2 v-if="title" class="pc-title">{{ title }}</h2>
      <div v-if="$slots.description" class="pc-desc">
        <slot name="description" />
      </div>
    </div>
    <div v-if="$slots.actions" class="pc-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.pc-header {
  /* flex:none:在 table/form/default 三布局的 flex 列中始终占固有高,不被压缩 */
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-space-4);
  padding: var(--app-space-4) var(--app-space-5);
  background: var(--app-bg-surface);
  border-bottom: 1px solid var(--app-border);
}

.pc-main {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
  min-width: 0;
}

.pc-title {
  margin: 0;
  font-size: var(--app-fs-h3);
  font-weight: var(--app-fw-h3);
  line-height: var(--app-lh-h3);
  color: var(--app-text-1);
}

.pc-desc {
  font-size: var(--app-fs-caption);
  line-height: var(--app-lh-caption);
  color: var(--app-text-2);
}

.pc-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  flex-shrink: 0;
}
</style>
