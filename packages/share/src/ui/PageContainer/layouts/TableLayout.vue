<script setup lang="ts">
/**
 * 表格页布局(纯 slot 模板):左侧筛选表单区 + 右侧表格区 + 右侧底部分页区。
 *
 * 配合 tu-design 组合式布局(table-render)使用:
 * - #form:FormRender(definition=table.search)+ 查询/重置外置按钮;
 * - #table:TableRender(:show-search="false" :show-pagination="false",数据链路不变);
 *   未提供 #table 时回退默认插槽内容(与 default/form 布局的 <slot /> 约定对齐);
 *   两者同传时 #table 优先;
 * - #pagination:TablePagination(definition 模式,单页自隐藏)。
 * 无 #form 时左栏整块不渲染,退化为单栏(表格区内滚、分页贴底)。
 * 查询/重置的 reload 归外置按钮(submit 通过 → reload(true)),骨架不持有状态。
 */
import { provide } from "vue";

defineOptions({ name: "TableLayout", inheritAttrs: false });

// 表格区填充协议(与 tu-design table-render PAGE_TABLE_FILL_KEY 同源字面量;
// share 不依赖 tu-design,故不走 import,升级时对照 constants.ts 校对):
// slot 内 TableRender 自动 fillHeight + sticky 表头(表体区滚、表头钉住)
provide("tu-design:page-table-fill", true);
</script>

<template>
  <div class="page-layout-table">
    <div class="table-main">
      <aside v-if="$slots.form" class="table-form">
        <slot name="form" />
      </aside>

      <div class="table-content">
        <div class="table-body">
          <slot name="table">
            <slot />
          </slot>
        </div>

        <footer v-if="$slots.pagination" class="table-pagination">
          <slot name="pagination" />
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全高填充布局(由 layout="table" 固有决定,无需路由/meta 参与):
   height:100% 锁定为容器可视高,内部 flex 分配——左栏定宽独立滚动,
   右栏纵向 flex:超高只在表格区内滚,分页条贴底不参与滚动 */
.page-layout-table {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.table-main {
  display: flex;
  flex: 1;
  gap: var(--app-space-3);
  min-height: 0;
}

.table-form {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--app-space-3);
  width: 220px;
  min-height: 0;
  padding: var(--app-space-4) var(--app-space-3);
  overflow-y: auto;
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}

.table-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--app-space-3);
  min-width: 0;
  min-height: 0;
}

.table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  min-width: 0;
  padding: var(--app-space-4) var(--app-space-5);
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}

.table-pagination {
  display: flex;
  flex: none;
  align-items: center;
  min-width: 0;
  padding: var(--app-space-2) var(--app-space-3);
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
}
</style>
