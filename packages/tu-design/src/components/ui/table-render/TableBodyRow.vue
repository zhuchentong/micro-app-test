<script setup lang="ts">
import type { PropType, VNodeChild } from "vue";
import { cloneVNode, h, isVNode } from "vue";
import { Checkbox } from "../../../components/ui/checkbox";
import { Tooltip } from "../../../components/ui/tooltip";
import { SELECTION_CELL } from "./constants";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import { stickyClass, stickyStyle, type StickyMap } from "./sticky";
import type { TableBodyLine, TableColumnOptions } from "./types";

const props = defineProps({
  /** 表体行数据（cells 值矩阵已由父层按可见列计算） */
  line: { type: Object as PropType<TableBodyLine>, required: true },
  /** 可见业务列（与 line.cells 同序） */
  columns: { type: Array as PropType<TableColumnOptions[]>, required: true },
  /** 选择列形态；undefined 不渲染选择单元格 */
  selection: {
    type: String as PropType<"radio" | "checkbox" | undefined>,
    default: undefined,
  },
  selected: { type: Boolean, default: false },
  sticky: { type: Object as PropType<StickyMap>, required: true },
  /** 树形缩进基准 px；undefined 表示未启用树形（不渲染 depth 缩进与 caret） */
  treeIndent: { type: Number, default: undefined },
});

const emit = defineEmits<{
  select: [checked: boolean];
  "row-click": [event: MouseEvent];
  "row-dblclick": [event: MouseEvent];
  "row-contextmenu": [event: MouseEvent];
  "cell-click": [columnKey: string, event: MouseEvent];
}>();

function cellText(line: TableBodyLine, index: number): string {
  const value = line.cells[index];
  return isVNode(value) ? "" : String(value ?? "");
}

/**
 * ellipsis: "tooltip" 的单元格内容：默认插槽承载截断内容（触发元素本体，不额外包裹），content 显示完整文本。
 * VNode（render 工厂）单元格经 cloneVNode 复制进触发位（VNode 不可二次挂载）。
 * @param value - 单元格原始内容（VNode 或文本）
 * @param text - 用于 tooltip content 与纯文本兜底的完整文本
 * @returns 包裹 Tooltip 后的渲染结果
 */
function tooltipCell(value: VNodeChild, text: string): VNodeChild {
  const trigger = isVNode(value) ? cloneVNode(value) : h("span", { class: "block truncate" }, text);
  return h(Tooltip, { delayDuration: 0, content: text }, { default: () => [trigger] });
}
</script>

<template>
  <tr
    class="border-b transition-colors hover:bg-muted/50"
    @click="emit('row-click', $event)"
    @dblclick="emit('row-dblclick', $event)"
    @contextmenu="emit('row-contextmenu', $event)"
  >
    <!-- 选择单元格：阻断冒泡避免触发行 row-click（S5）；radio 为原生控件 -->
    <td
      v-if="props.selection"
      class="w-12 p-2 text-center align-middle"
      :class="stickyClass(props.sticky, SELECTION_CELL)"
      :style="stickyStyle(props.sticky, SELECTION_CELL, false)"
      @click.stop
    >
      <input
        v-if="props.selection === 'radio'"
        type="radio"
        class="accent-primary size-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        :checked="props.selected"
        :disabled="!props.line.canSelect"
        :aria-label="`选择第 ${props.line.index + 1} 行`"
        @click="emit('select', !props.selected)"
      />
      <Checkbox
        v-else
        :checked="props.selected"
        :disabled="!props.line.canSelect"
        :aria-label="`选择第 ${props.line.index + 1} 行`"
        @update:checked="(checked: boolean) => emit('select', checked)"
      />
    </td>
    <td
      v-for="(value, index) in props.line.cells"
      :key="props.columns[index].key"
      class="p-2 align-middle"
      :class="[
        stickyClass(props.sticky, props.columns[index].key),
        { truncate: props.columns[index].ellipsis === true },
      ]"
      :title="props.columns[index].ellipsis === true ? cellText(props.line, index) : undefined"
      :style="[
        { textAlign: props.columns[index].align ?? 'center' },
        stickyStyle(props.sticky, props.columns[index].key, false),
      ]"
      @click="emit('cell-click', props.columns[index].key, $event)"
    >
      <!-- 首列（tree 启用时）：depth 缩进 + 展开 caret（点击 stop 避免误触发行点击） -->
      <span
        v-if="props.treeIndent !== undefined && index === 0"
        class="inline-flex max-w-full items-center gap-1"
        :style="{ marginLeft: `${props.line.row.depth * props.treeIndent}px` }"
      >
        <button
          v-if="props.line.row.getCanExpand()"
          type="button"
          class="hover:bg-muted text-muted-foreground inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
          :aria-expanded="props.line.row.getIsExpanded()"
          :aria-label="props.line.row.getIsExpanded() ? '收起' : '展开'"
          @click.stop="props.line.row.toggleExpanded()"
        >
          <ChevronIcon
            class="size-3.5 transition-transform"
            :class="{ 'rotate-90': props.line.row.getIsExpanded() }"
          />
        </button>
        <!-- VNode 必须走子节点渲染；文本插值会序列化 vnode 导致循环引用 -->
        <component :is="value" v-if="isVNode(value)" />
        <span v-else class="min-w-0 truncate">{{ value }}</span>
      </span>
      <!-- ellipsis: "tooltip"：Tooltip 包装（VNode 经 cloneVNode 复制，避免二次挂载） -->
      <component
        :is="tooltipCell(value, cellText(props.line, index))"
        v-else-if="props.columns[index].ellipsis === 'tooltip'"
      />
      <template v-else>
        <!-- VNode 必须走子节点渲染；文本插值会序列化 vnode 导致循环引用 -->
        <component :is="value" v-if="isVNode(value)" />
        <template v-else>{{ value }}</template>
      </template>
    </td>
  </tr>
</template>
