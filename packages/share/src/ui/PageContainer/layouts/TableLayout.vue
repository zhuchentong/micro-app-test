<script setup lang="ts">
import PageHeader from "../PageHeader.vue";

/**
 * 表格页布局(纯 slot 模板):标题区 + 工具栏 + 表格区 + 底部分页区。
 * 表格页常有非标结构(详情侧栏、多级表格等),由页面用 slot 组合。
 */
defineOptions({ name: "TableLayout" });

defineProps<{ title?: string }>();
</script>

<template>
  <div class="page-layout-table">
    <!-- 空标题区(无 title 且无 description/actions)整块不渲染,避免留空条 -->
    <PageHeader v-if="title || $slots.description || $slots.actions" :title="title">
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <div v-if="$slots.toolbar" class="table-toolbar">
      <slot name="toolbar" />
    </div>

    <div class="table-body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="table-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
/* 全高填充布局(由 layout="table" 固有决定,无需路由/meta 参与):
   height:100% 锁定为容器可视高,内部 flex 分配,超高只在表格区滚动 */
.page-layout-table {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.table-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-3) var(--app-space-5);
  background: var(--app-bg-surface);
  border-bottom: 1px solid var(--app-border);
}

.table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  min-width: 0;
  padding: var(--app-space-4) var(--app-space-5);
}

.table-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
  padding: var(--app-space-3) var(--app-space-5);
  border-top: 1px solid var(--app-border);
}
</style>
