<script setup lang="ts">
import type { PropType } from "vue";
import type { TableRenderDefinition } from "./types";
import {
  PaginationEllipsis as ArkPaginationEllipsis,
  PaginationItem as ArkPaginationItem,
  PaginationNextTrigger as ArkPaginationNextTrigger,
  PaginationPrevTrigger as ArkPaginationPrevTrigger,
  PaginationRoot as ArkPaginationRoot,
} from "@ark-ui/vue/pagination";
import { computed } from "vue";
import { cn } from "../../../lib/utils";

// boolean props 用运行时声明 + default: undefined 禁用 Vue 的 Boolean casting
// （casting 会让未传的 prop 变 false；TableRender/FormRender 同款约定）
const props = defineProps({
  /** 组合式：传 defineTable 返回值，自动接线 page/动作并按 R13 单页自隐藏；
   * 与手动分页 props 同传时以 definition 为准（DEV 警告，R29/R4 对齐） */
  definition: { type: Object as PropType<TableRenderDefinition<any>> },
  /** 1-based 当前页码（手动模式） */
  pageIndex: { type: Number, default: undefined },
  pageSize: { type: Number, default: undefined },
  pageSizeOpts: { type: Array as PropType<readonly number[]>, default: undefined },
  total: { type: Number, default: undefined },
  /** 「共 N 条」，缺省 true */
  showTotal: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 条/页 select，缺省 false（组合式简形分页条可保持关闭） */
  showSizeSelect: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 上一页/下一页形态：text 文字（缺省）/ icon 图标 */
  navMode: { type: String as PropType<"text" | "icon">, default: "text" },
});

const emit = defineEmits<{
  "update:pageIndex": [pageIndex: number];
  "update:pageSize": [pageSize: number];
}>();

// R29 输入解析在 setup 期定版（definition/手动模式不支持运行时切换，同 TableRender 约定）：
// ① definition 与手动分页 props 同传 → 以 definition 为准（DEV 警告）；
// ② 仅手动且缺 pageIndex/pageSize/total 任一 → DEV 警告 + 不渲染
if (import.meta.env.DEV) {
  if (
    props.definition &&
    (props.pageIndex !== undefined ||
      props.pageSize !== undefined ||
      props.pageSizeOpts !== undefined ||
      props.total !== undefined)
  ) {
    console.warn(
      "[tu-design] <TablePagination> definition 与手动分页 props 同传，已按 definition 渲染。",
    );
  }
  if (
    !props.definition &&
    (props.pageIndex === undefined || props.pageSize === undefined || props.total === undefined)
  ) {
    console.warn(
      "[tu-design] <TablePagination> 缺少 definition 或 pageIndex/pageSize/total，组件不渲染。",
    );
  }
}

// R29：definition 优先投影；手动模式直读 props（缺省 undefined 走 visible 兜底）
const pageIndex = computed(() => props.definition?.page.pageIndex ?? props.pageIndex);
const pageSize = computed(() => props.definition?.page.pageSize ?? props.pageSize);
const pageSizeOpts = computed(() => props.definition?.page.pageSizeOpts ?? props.pageSizeOpts);
const total = computed(() => props.definition?.page.total ?? props.total);
const totalPages = computed(() =>
  Math.max(1, Math.ceil((total.value ?? 0) / (pageSize.value ?? 1))),
);

/** 可见性：definition 模式按 R13 单页自隐藏；手动模式须 pageIndex/pageSize/total 齐备（缺项 DEV 警告 + 不渲染） */
const visible = computed(() => {
  if (props.definition !== undefined) {
    return Math.ceil((total.value ?? 0) / (pageSize.value ?? 1)) > 1;
  }
  return props.pageIndex !== undefined && props.pageSize !== undefined && props.total !== undefined;
});

const showTotalBar = computed(() => props.showTotal ?? true);
const showSelect = computed(() => props.showSizeSelect ?? false);
const iconMode = computed(() => props.navMode === "icon");
const hasLeft = computed(() => showTotalBar.value || showSelect.value);

// definition 模式经实例动作接线（R29）；事件恒 emit（幂等：同值重复设置无害），便于本地联动
function onPageIndex(value: number) {
  props.definition?.setPageIndex(value);
  emit("update:pageIndex", value);
}

function onPageSize(value: number) {
  props.definition?.setPageSize(value);
  emit("update:pageSize", value);
}

/** 页码窗口：首页/尾页 + 当前页 ±1，跳过段用省略号（D12） */
const pages = computed<(number | string)[]>(() => {
  const count = totalPages.value;
  const current = pageIndex.value ?? 1;
  const window = [...new Set([1, count, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= count)
    .sort((a, b) => a - b);

  const items: (number | string)[] = [];
  let previous = 0;
  for (const page of window) {
    if (previous && page - previous > 1) items.push("…");
    items.push(page);
    previous = page;
  }
  return items;
});
</script>

<template>
  <!-- R31：不带 border-t（布局归使用方，TableRender 内置使用处显式补）；左区缺省时页码靠右 -->
  <div
    v-if="visible"
    :class="
      cn(
        'flex w-full items-center gap-4 p-2 text-sm',
        hasLeft ? 'justify-between' : 'justify-end',
        $attrs.class,
      )
    "
  >
    <div v-if="hasLeft" class="flex items-center gap-2 text-muted-foreground">
      <span v-if="showTotalBar">共 {{ total }} 条</span>
      <select
        v-if="showSelect"
        class="h-8 rounded-md border bg-transparent px-2 text-sm"
        :value="pageSize"
        @change="onPageSize(Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="size in pageSizeOpts" :key="size" :value="size">{{ size }} 条/页</option>
      </select>
    </div>

    <!-- Root 渲染为裸 nav 且 Ellipsis 是块级 div，必须显式 flex 才不会断行 -->
    <ArkPaginationRoot
      class="flex items-center gap-1"
      :count="total ?? 0"
      :page="pageIndex ?? 1"
      :page-size="pageSize ?? 1"
      :sibling-count="1"
      @page-change="onPageIndex($event.page)"
    >
      <ArkPaginationPrevTrigger
        class="h-8 rounded-md border px-2 disabled:opacity-50"
        :class="{ 'px-3': !iconMode }"
        :disabled="(pageIndex ?? 1) <= 1"
        :aria-label="iconMode ? '上一页' : undefined"
      >
        <svg
          v-if="iconMode"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        <template v-else>上一页</template>
      </ArkPaginationPrevTrigger>

      <template
        v-for="(item, index) in pages"
        :key="typeof item === 'number' ? item : `gap-${index}`"
      >
        <ArkPaginationEllipsis v-if="typeof item === 'string'" :index="index" />
        <ArkPaginationItem
          v-else
          type="page"
          class="h-8 min-w-8 rounded-md border px-2 data-[selected]:bg-primary data-[selected]:text-primary-foreground"
          :value="item"
        >
          {{ item }}
        </ArkPaginationItem>
      </template>

      <ArkPaginationNextTrigger
        class="h-8 rounded-md border px-2 disabled:opacity-50"
        :class="{ 'px-3': !iconMode }"
        :disabled="(pageIndex ?? 1) >= totalPages"
        :aria-label="iconMode ? '下一页' : undefined"
      >
        <svg
          v-if="iconMode"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <template v-else>下一页</template>
      </ArkPaginationNextTrigger>
    </ArkPaginationRoot>
  </div>
</template>
