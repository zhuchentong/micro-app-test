<script setup lang="ts">
import PageHeader from "../PageHeader.vue";

/**
 * 表单页布局(纯 slot 模板):标题区 + 表单区 + 底部操作栏。
 * 底部操作栏用 flex column 常驻文档流,不用 position:sticky ——
 * wujie 容器内滚动祖先不确定,sticky 生效条件不可控。
 */
defineOptions({ name: "FormLayout" });

defineProps<{ title?: string }>();
</script>

<template>
  <div class="page-layout-form">
    <!-- 空标题区(无 title 且无 description)整块不渲染,避免留空条 -->
    <PageHeader v-if="title || $slots.description" :title="title">
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
    </PageHeader>

    <div class="form-body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="form-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
/* 全高填充布局(由 layout="form" 固有决定):height:100% 锁定容器可视高,
   表单区吃满剩余高度内部滚动,底部操作栏常驻 */
.page-layout-form {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  min-width: 0;
  padding: var(--app-space-5);
}

.form-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-2);
  padding: var(--app-space-3) var(--app-space-5);
  background: var(--app-bg-surface);
  border-top: 1px solid var(--app-border);
}
</style>
