<script setup lang="ts">
import type { PropType } from "vue";
import { computed } from "vue";
import { cn } from "../../../lib/utils";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import type { Key, TreeNode, TreeOption } from "../tree-shared";

const props = defineProps({
  /** 列数据：columns[0] 为根层，后续每列为展开路径的子层 */
  columns: { type: Array as PropType<TreeNode[][]>, required: true },
  /** 下级展开触发方式 */
  expandTrigger: { type: String as PropType<"click" | "hover">, default: "click" },
  /** 已选中的 key（单选叶子 / 多选勾选值） */
  selectedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 勾选模式（显示 checkbox） */
  checkable: { type: Boolean, default: false },
  checkedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  indeterminateKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 键盘游标所在节点 */
  activeKey: { type: [String, Number] as PropType<Key | null>, default: null },
  /** 节点是否处于展开路径上（父组件传入，用于箭头朝向） */
  isExpanded: { type: Function as PropType<(node: TreeNode) => boolean>, required: true },
});

const emit = defineEmits<{
  /** 展开 node 的下级列 */
  expand: [node: TreeNode];
  /** 点击行（非叶子→展开，叶子→选中/勾选，语义由父组件解释） */
  select: [node: TreeNode];
  /** 勾选切换 */
  check: [node: TreeNode];
}>();

function labelOf(node: TreeNode): string {
  return (node.rawNode as TreeOption).label ?? String(node.key);
}

// 每个可见节点都会查选中/勾选态：先 Set 化，避免对数组逐项 includes 的 O(n·k)
const selectedSet = computed(() => new Set(props.selectedKeys));
const checkedSet = computed(() => new Set(props.checkedKeys));
const indeterminateSet = computed(() => new Set(props.indeterminateKeys));

function rowClick(node: TreeNode) {
  if (node.disabled) return;
  emit("select", node);
}

function expandHover(node: TreeNode) {
  if (props.expandTrigger === "hover" && node.children?.length && !node.disabled) {
    emit("expand", node);
  }
}

function toggleCheck(node: TreeNode) {
  if (!node.disabled) emit("check", node);
}
</script>

<template>
  <div data-part="cascader-panel" :class="cn('flex overflow-x-auto', $attrs.class)">
    <div
      v-for="(column, ci) in props.columns"
      :key="ci"
      role="listbox"
      data-part="column"
      :aria-label="`第 ${ci + 1} 列`"
      class="max-h-[280px] min-w-36 overflow-y-auto border-r border-border py-1 last:border-r-0"
    >
      <div
        v-for="node in column"
        :key="node.key"
        data-part="tree-node"
        :data-key="node.key"
        role="option"
        :aria-selected="selectedSet.has(node.key)"
        :aria-checked="props.checkable ? checkedSet.has(node.key) : undefined"
        :aria-expanded="node.children?.length ? props.isExpanded(node) : undefined"
        :aria-disabled="node.disabled || undefined"
        :data-selected="selectedSet.has(node.key) || undefined"
        :data-checked="checkedSet.has(node.key) || undefined"
        :data-indeterminate="indeterminateSet.has(node.key) || undefined"
        :data-active="props.activeKey === node.key || undefined"
        class="flex cursor-pointer items-center gap-1 px-3 py-1.5 text-sm outline-none hover:bg-accent data-[active]:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
        @click="rowClick(node)"
        @pointerenter="expandHover(node)"
      >
        <span
          v-if="props.checkable"
          data-part="checkbox"
          class="flex size-4 shrink-0 items-center justify-center rounded-sm border"
          :class="
            checkedSet.has(node.key)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input'
          "
          @click.stop="toggleCheck(node)"
        >
          <svg
            v-if="checkedSet.has(node.key)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            class="size-3"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <svg
            v-else-if="indeterminateSet.has(node.key)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            class="size-3"
          >
            <path d="M5 12h14" />
          </svg>
        </span>
        <span class="flex-1 truncate">{{ labelOf(node) }}</span>
        <ChevronIcon
          v-if="node.children?.length"
          :class="
            cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              props.isExpanded(node) && 'rotate-90',
            )
          "
        />
      </div>
      <div v-if="!column.length" class="px-3 py-1.5 text-sm text-muted-foreground">无数据</div>
    </div>
  </div>
</template>
