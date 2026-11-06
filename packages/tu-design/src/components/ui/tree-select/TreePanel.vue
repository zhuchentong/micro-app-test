<script setup lang="ts">
import type { PropType } from "vue";
import { computed } from "vue";
import { cn } from "../../../lib/utils";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import type { Key, TreeNode } from "../tree-shared";
import type { TreeOption } from "../tree-shared";

const props = defineProps({
  /** 展开态扁平化的可见节点序列（来自 treeMate.getFlattenedNodes(expandedKeys)） */
  nodes: { type: Array as PropType<Array<TreeNode>>, required: true },
  /** 当前选中键集合（用于 data-selected 回显） */
  selectedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 展开的分支键集合 */
  expandedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 键盘活动节点（Task 5 启用） */
  activeKey: { type: [String, Number] as PropType<Key | null>, default: null },
  /** 勾选模式：行首渲染 checkbox，选中语义由 checkedKeys 驱动 */
  checkable: { type: Boolean, default: false },
  /** 勾选键集合（级联归一后） */
  checkedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 半选键集合 */
  indeterminateKeys: { type: Array as PropType<Key[]>, default: () => [] },
});

const emit = defineEmits<{
  select: [node: TreeNode];
  toggle: [node: TreeNode];
}>();

function label(node: TreeNode): string {
  return (node.rawNode as TreeOption).label ?? String(node.key);
}

// 每节点渲染都会查选中/展开/勾选态：先 Set 化，避免对数组逐项 includes 的 O(n·k)
const selectedSet = computed(() => new Set(props.selectedKeys));
const expandedSet = computed(() => new Set(props.expandedKeys));
const checkedSet = computed(() => new Set(props.checkedKeys));
const indeterminateSet = computed(() => new Set(props.indeterminateKeys));

function hasChildren(node: TreeNode): boolean {
  return !node.isLeaf && !!node.children?.length;
}

function isExpanded(node: TreeNode): boolean {
  return hasChildren(node) && expandedSet.value.has(node.key);
}

function isSelected(node: TreeNode): boolean {
  return props.checkable ? checkedSet.value.has(node.key) : selectedSet.value.has(node.key);
}

function isChecked(node: TreeNode): boolean {
  return checkedSet.value.has(node.key);
}

function isIndeterminate(node: TreeNode): boolean {
  return indeterminateSet.value.has(node.key);
}
</script>

<template>
  <div :class="cn('max-h-[280px] overflow-auto p-1', $attrs.class)" role="tree">
    <div
      v-for="node in nodes"
      :key="node.key"
      role="treeitem"
      :aria-level="node.level + 1"
      :aria-selected="isSelected(node)"
      :aria-checked="props.checkable ? isChecked(node) : undefined"
      :aria-expanded="hasChildren(node) ? isExpanded(node) : undefined"
      data-part="tree-node"
      :data-key="node.key"
      :data-selected="isSelected(node) ? '' : undefined"
      :data-checked="isChecked(node) ? '' : undefined"
      :data-indeterminate="isIndeterminate(node) ? '' : undefined"
      :data-active="activeKey === node.key ? '' : undefined"
      class="flex cursor-pointer items-center gap-1 rounded-sm py-1.5 pr-2 text-sm outline-none hover:bg-accent data-[active]:bg-accent data-[selected]:bg-accent"
      :style="{ paddingLeft: `${node.level * 16 + 8}px` }"
      @click="emit('select', node)"
    >
      <span
        v-if="hasChildren(node)"
        data-part="expand"
        class="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
        :aria-label="isExpanded(node) ? '折叠' : '展开'"
        @click.stop="emit('toggle', node)"
      >
        <ChevronIcon
          class="size-4 shrink-0 transition-transform"
          :class="isExpanded(node) ? 'rotate-90' : ''"
        />
      </span>
      <span v-else class="size-4 shrink-0" aria-hidden="true" />
      <span
        v-if="props.checkable"
        data-part="checkbox"
        :data-checked="isChecked(node) ? '' : undefined"
        :data-indeterminate="isIndeterminate(node) ? '' : undefined"
        class="flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-input bg-background text-background data-[checked]:border-primary data-[checked]:bg-primary data-[indeterminate]:border-primary data-[indeterminate]:bg-primary"
        aria-hidden="true"
      >
        <svg
          v-if="isChecked(node)"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-3"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <svg
          v-else-if="isIndeterminate(node)"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          class="size-3"
        >
          <path d="M5 12h14" />
        </svg>
      </span>
      <span class="truncate">{{ label(node) }}</span>
    </div>
    <div v-if="nodes.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
      无数据
    </div>
  </div>
</template>
