<script setup lang="ts">
import { Popover as ArkPopover } from "@ark-ui/vue/popover";
import type { PopoverRootProps } from "@ark-ui/vue/popover";
import type { PropType } from "vue";
import { computed, getCurrentInstance, nextTick, ref, useAttrs, watch } from "vue";
import { cn } from "../../../lib/utils";
import { controlCls } from "../date-shared/shared";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useOverlayIds } from "../overlay-shared/useOverlayIds";
import { useSandboxTeleportTarget, withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import CloseIcon from "../icon-shared/CloseIcon.vue";
import ValueTags from "../tree-shared/ValueTags.vue";

// ids 全量覆盖（无冒号）：ArkPopover 浮层载体，规避 wujie patch getElementById
// 对 zag 缺省冒号 id 的 SyntaxError 刷屏（详注见 useOverlayIds）
const { ids: rootIds } = useOverlayIds(useAttrs(), {
  primary: "content",
  parts: [
    "content",
    "title",
    "description",
    "anchor",
    "trigger",
    "closeTrigger",
    "positioner",
    "arrow",
  ],
});
import {
  createTreeMate,
  type CheckStrategy,
  type Key,
  type TreeNode,
  type TreeOption,
} from "../tree-shared";
import { nextActiveKey, type MoveKey } from "../tree-shared/keyboard";
import CascaderPanel from "./CascaderPanel.vue";

const props = defineProps({
  /** 树形选项（key 必填，label 展示名，children 子级） */
  options: { type: Array as PropType<TreeOption[]>, required: true },
  /** 受控值：单选为叶子 key，multiple/checkable 为 key 数组；undefined 走内部非受控 */
  modelValue: {
    type: [String, Number, Array] as PropType<Key | Key[] | undefined>,
    default: undefined,
  },
  defaultValue: {
    type: [String, Number, Array] as PropType<Key | Key[] | undefined>,
    default: undefined,
  },
  /** 多选（值恒为数组） */
  multiple: { type: Boolean, default: false },
  /** 勾选模式（隐含 multiple，值恒为数组） */
  checkable: { type: Boolean, default: false },
  /** 级联勾选：父子联动（默认 false，对齐 naive-ui） */
  cascade: { type: Boolean, default: false },
  /** 勾选策略：all=全选节点 child=仅叶子 parent=仅父级 */
  checkStrategy: { type: String as PropType<CheckStrategy>, default: "all" },
  /** 下级展开触发方式 */
  expandTrigger: { type: String as PropType<"click" | "hover">, default: "click" },
  /** 回显是否拼接完整路径 */
  showPath: { type: Boolean, default: true },
  /** 路径拼接分隔符 */
  separator: { type: String, default: " / " },
  /** 展示清空按钮 */
  clearable: { type: Boolean, default: false },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  placeholder: { type: String, default: "请选择" },
  /** 多选时最多展示的标签数，超出折叠为 +N */
  maxTagCount: { type: Number, default: undefined },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  /** Ark Popover Root 的 positioning 配置（placement/gutter 等）；
      iframe realm（wujie graft / iframe 嵌入）下 strategy 未显式指定时默认 fixed */
  positioning: {
    type: Object as PropType<PopoverRootProps["positioning"]>,
    default: undefined,
  },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{
  "update:modelValue": [value: Key | Key[] | undefined];
  /** @deprecated 请改用 update:open（v-model:open）；下一个 minor 移除 */
  "update:show": [open: boolean];
  "update:open": [open: boolean];
}>();

if (import.meta.env.DEV && getCurrentInstance()?.vnode.props?.["onUpdate:show"]) {
  console.warn("[tu-design] <Cascader> update:show 已弃用，请改用 update:open（v-model:open）。");
}

// attrs（id/aria-*）转发给触发器，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

const toArrayValue = (v: Key | Key[] | undefined): Key[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];

const treeMate = computed(() => createTreeMate(props.options, { ignoreEmptyChildren: true }));
const isMulti = computed(() => props.multiple || props.checkable);

// —— 受控桥接（Select 同款）：Root 恒走受控，非受控语义由内部 ref 实现 ——
const internalValue = ref<Key | Key[] | undefined>(props.defaultValue);
const value = computed(() =>
  props.modelValue !== undefined ? props.modelValue : internalValue.value,
);
const selectedKeys = computed<Key[]>(() => toArrayValue(value.value));

const checkedState = computed<{ checked: Key[]; indeterminate: Key[] }>(() => {
  if (!props.checkable) return { checked: [], indeterminate: [] };
  const merged = treeMate.value.getCheckedKeys(toArrayValue(value.value), {
    cascade: props.cascade,
    checkStrategy: props.checkStrategy,
  });
  return { checked: merged.checkedKeys, indeterminate: merged.indeterminateKeys };
});

// 勾选选项运行时变化：值集合按新选项归一
watch(
  () => [props.cascade, props.checkStrategy] as const,
  () => {
    if (!props.checkable) return;
    const merged = treeMate.value.getCheckedKeys(toArrayValue(value.value), {
      cascade: props.cascade,
      checkStrategy: props.checkStrategy,
    });
    internalValue.value = merged.checkedKeys;
    emit("update:modelValue", merged.checkedKeys);
  },
);

// —— 弹层开合（点击/键盘 ↓ 显式驱动，保证各环境一致）——
const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => {
    emit("update:open", open);
    emit("update:show", open);
  },
});

// —— 沙箱适配（机制详注见 useSandboxOverlay / sandbox.ts）：Teleport 目标降级
// （shadow DOM / wujie graft → 应用挂载容器，避免面板落入 iframe body）+
// iframe realm 下 strategy 默认 fixed（absolute 包含块错位，fixed 唯一正确解）；
// 无 to prop，面板恒传送 ——
const teleportTarget = useSandboxTeleportTarget(() => undefined);
const rootPositioning = computed(() =>
  withSandboxStrategy(props.positioning, { ...props.positioning }),
);

function openFromInput() {
  if (props.disabled || isOpen.value) return;
  syncPanelWidth();
  setOpen(true);
}

// —— 面板宽度对齐触发器 ——
const triggerEl = ref<HTMLElement | null>(null);
const panelMinWidth = ref("0px");
function syncPanelWidth() {
  panelMinWidth.value = `${triggerEl.value?.offsetWidth ?? 0}px`;
}

function commitValue(next: Key | Key[] | undefined) {
  internalValue.value = next;
  emit("update:modelValue", next);
}

function handleClear() {
  commitValue(isMulti.value ? [] : undefined);
}

function removeTag(key: Key) {
  if (props.checkable) {
    const merged = treeMate.value.uncheck(key, toArrayValue(value.value), {
      cascade: props.cascade,
      checkStrategy: props.checkStrategy,
    });
    commitValue(merged.checkedKeys);
    return;
  }
  commitValue(selectedKeys.value.filter((k) => k !== key));
}

// —— 展开路径（单路径：展开新列即收敛到该节点路径）——
const expandedPath = ref<Key[]>([]);
const columns = computed<TreeNode[][]>(() => {
  const result: TreeNode[][] = [treeMate.value.treeNodes];
  let current = treeMate.value.treeNodes;
  for (const key of expandedPath.value) {
    const node = current.find((n) => n.key === key);
    if (!node?.children?.length) break;
    current = node.children;
    result.push(current);
  }
  return result;
});

const expandedPathSet = computed(() => new Set(expandedPath.value));

function isExpanded(node: TreeNode): boolean {
  return expandedPathSet.value.has(node.key);
}

function handleExpand(node: TreeNode) {
  expandedPath.value = treeMate.value.getPath(node.key).keyPath;
}

function toggleCheck(node: TreeNode) {
  const current = toArrayValue(value.value);
  const op = current.includes(node.key) ? "uncheck" : "check";
  const merged = treeMate.value[op](node.key, current, {
    cascade: props.cascade,
    checkStrategy: props.checkStrategy,
  });
  commitValue(merged.checkedKeys);
}

function handleSelect(node: TreeNode) {
  // 级联语义：非叶子仅展开，叶子才选中/勾选
  if (node.children?.length) {
    handleExpand(node);
    return;
  }
  if (props.checkable) {
    toggleCheck(node);
    return;
  }
  if (props.multiple) {
    const current = selectedKeys.value;
    commitValue(
      current.includes(node.key) ? current.filter((k) => k !== node.key) : [...current, node.key],
    );
    return;
  }
  commitValue(node.key);
  setOpen(false);
}

// —— 回显：showPath 拼 keyPath 标签 ——
function labelOf(node: TreeNode): string {
  return (node.rawNode as TreeOption).label ?? String(node.key);
}

function pathLabel(key: Key): string {
  const path = treeMate.value.getPath(key).keyPath;
  return path
    .map((k) => {
      const node = treeMate.value.getNode(k);
      return node ? labelOf(node as unknown as TreeNode) : String(k);
    })
    .join(props.separator);
}

function displayLabel(key: Key): string {
  const node = treeMate.value.getNode(key);
  if (!node) return "";
  return props.showPath ? pathLabel(key) : labelOf(node as unknown as TreeNode);
}

const singleLabel = computed(() =>
  isMulti.value ? "" : displayLabel(selectedKeys.value[0]!) || "",
);

const tags = computed(() =>
  selectedKeys.value
    .map((key) => ({ key, label: displayLabel(key) }))
    .filter((t) => t.label !== ""),
);

const hasValue = computed(() => tags.value.length > 0);

// —— 键盘导航（↑↓ 在 activeKey 所在列内移动，不跨列；←→/Enter 由下方分支处理）——
const activeKey = ref<Key | null>(null);
const MOVE_KEYS: MoveKey[] = ["ArrowDown", "ArrowUp", "Home", "End"];

// activeKey 落在哪一列（无 active 或找不到时视为第 0 列）
function activeColumn(): TreeNode[] {
  for (const col of columns.value) {
    if (col.some((n) => n.key === activeKey.value)) return col;
  }
  return columns.value[0] ?? [];
}

function scrollActiveIntoView() {
  nextTick(() => {
    document
      .querySelector('[data-part="cascader-panel"] [data-part="tree-node"][data-active]')
      ?.scrollIntoView?.({ block: "nearest" });
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (!isOpen.value) {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      openFromInput();
    }
    return;
  }
  if ((MOVE_KEYS as string[]).includes(e.key)) {
    e.preventDefault();
    activeKey.value = nextActiveKey(activeColumn(), activeKey.value, e.key as MoveKey);
    scrollActiveIntoView();
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    const node = activeColumn().find((n) => n.key === activeKey.value);
    if (node?.children?.length) {
      handleExpand(node);
      const firstChild = node.children.find((c) => !c.disabled);
      if (firstChild) activeKey.value = firstChild.key;
    }
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    const node = activeColumn().find((n) => n.key === activeKey.value);
    const parent = node?.parent;
    if (parent && !parent.ignored) {
      expandedPath.value = treeMate.value.getPath(parent.key).keyPath.slice(0, -1);
      activeKey.value = parent.key;
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const node = activeColumn().find((n) => n.key === activeKey.value);
    if (node && !node.disabled) handleSelect(node);
  }
}

// 弹层开合时重置键盘游标与展开路径
watch(isOpen, (open) => {
  activeKey.value = null;
  if (open) syncPanelWidth();
  else expandedPath.value = [];
});
</script>

<template>
  <ArkPopover.Root
    :ids="rootIds"
    :open="isOpen"
    :positioning="rootPositioning"
    @update:open="setOpen"
  >
    <ArkPopover.Anchor as-child>
      <div
        ref="triggerEl"
        v-bind="$attrs"
        data-part="trigger"
        role="button"
        tabindex="0"
        :aria-expanded="isOpen"
        aria-haspopup="true"
        :aria-disabled="props.disabled || undefined"
        :class="
          cn(
            controlCls,
            'min-h-9 cursor-pointer gap-2 px-3 py-1.5 text-sm',
            props.disabled && 'cursor-not-allowed opacity-50',
            props.class,
          )
        "
        @click="openFromInput"
        @keydown="handleKeydown"
      >
        <template v-if="isMulti">
          <ValueTags
            v-if="tags.length"
            :values="tags"
            :max-tag-count="props.maxTagCount"
            :disabled="!!props.disabled"
            @remove="removeTag"
          />
          <span v-if="!tags.length" class="truncate text-muted-foreground">{{
            props.placeholder
          }}</span>
        </template>
        <template v-else>
          <span v-if="singleLabel" class="truncate">{{ singleLabel }}</span>
          <span v-else class="truncate text-muted-foreground">{{ props.placeholder }}</span>
        </template>
        <span class="ml-auto flex shrink-0 items-center gap-1">
          <span
            v-if="props.clearable && hasValue && !props.disabled"
            role="button"
            data-part="clear"
            class="text-muted-foreground hover:text-foreground"
            aria-label="清空"
            @click.stop="handleClear"
          >
            <CloseIcon class="size-4 shrink-0" />
          </span>
          <ChevronIcon
            :class="
              cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                isOpen ? '-rotate-90' : 'rotate-90',
              )
            "
          />
        </span>
      </div>
    </ArkPopover.Anchor>
    <Teleport :to="teleportTarget">
      <ArkPopover.Positioner class="z-[var(--z-overlay)]">
        <ArkPopover.Content
          :class="
            cn(
              'bg-popover text-popover-foreground z-[var(--z-overlay)] rounded-md border p-0 shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            )
          "
          :style="{ minWidth: panelMinWidth }"
          @keydown="handleKeydown"
        >
          <CascaderPanel
            :columns="columns"
            :expand-trigger="props.expandTrigger"
            :selected-keys="isMulti ? selectedKeys : []"
            :checkable="props.checkable"
            :checked-keys="checkedState.checked"
            :indeterminate-keys="checkedState.indeterminate"
            :active-key="activeKey"
            :is-expanded="isExpanded"
            @expand="handleExpand"
            @select="handleSelect"
            @check="toggleCheck"
          />
        </ArkPopover.Content>
      </ArkPopover.Positioner>
    </Teleport>
  </ArkPopover.Root>
</template>
