<script setup lang="ts">
import type { PropType } from "vue";
import { computed, getCurrentInstance, nextTick, ref, useAttrs, watch } from "vue";
import { Popover as ArkPopover } from "@ark-ui/vue/popover";
import type { PopoverRootProps } from "@ark-ui/vue/popover";
import { cn } from "../../../lib/utils";
import { controlCls } from "../date-shared/shared";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useOverlayIds } from "../overlay-shared/useOverlayIds";
import { useSandboxTeleportTarget, withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import CloseIcon from "../icon-shared/CloseIcon.vue";
import ValueTags from "../tree-shared/ValueTags.vue";
import { createTreeMate, type Key, type TreeNode, type TreeOption } from "../tree-shared";
import { nextActiveKey, type MoveKey } from "../tree-shared/keyboard";

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
import TreePanel from "./TreePanel.vue";
import type { TreeSelectTag } from "./types";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  /** 树选项（key/label/children/disabled） */
  options: { type: Array as PropType<TreeOption[]>, required: true },
  /** 当前值：单选为 key，multiple 为 key 数组；不传走内部非受控 */
  modelValue: {
    type: [String, Number, Array] as PropType<Key | Key[] | undefined>,
    default: undefined,
  },
  defaultValue: {
    type: [String, Number, Array] as PropType<Key | Key[] | undefined>,
    default: undefined,
  },
  /** 多选：值恒为数组，点击节点切换选中 */
  multiple: { type: Boolean, default: false },
  /** 勾选模式：行首渲染 checkbox，值恒为数组（隐含多选语义） */
  checkable: { type: Boolean, default: false },
  /** 勾选级联：勾选父级联动全部子级（默认 false，对齐 naive-ui） */
  cascade: { type: Boolean, default: false },
  /** 勾选策略：all 值含全选节点 / parent 仅父 / child 仅叶（默认 all） */
  checkStrategy: { type: String as PropType<"all" | "parent" | "child">, default: "all" },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  placeholder: { type: String, default: "请选择" },
  /** 多选最多展示标签数，超出折叠为 +N */
  maxTagCount: { type: Number, default: undefined },
  /** 展示清空按钮 */
  clearable: { type: Boolean, default: false },
  /** 可搜索：触发器内嵌输入框，按 label 过滤（展示命中节点及其祖先路径） */
  filterable: { type: Boolean, default: false },
  /** 受控展开键集合；undefined 走内部非受控 */
  expandedKeys: { type: Array as PropType<Key[] | undefined>, default: undefined },
  defaultExpandedKeys: { type: Array as PropType<Key[]>, default: () => [] },
  /** 初始展开全部分支 */
  defaultExpandAll: { type: Boolean, default: false },
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
  "update:expandedKeys": [keys: Key[]];
}>();

if (import.meta.env.DEV && getCurrentInstance()?.vnode.props?.["onUpdate:show"]) {
  console.warn("[tu-design] <TreeSelect> update:show 已弃用，请改用 update:open（v-model:open）。");
}

// —— 受控桥接（Select/DatePicker 同款）：Root 恒走受控，非受控语义由内部 ref 实现 ——
const internalValue = ref<Key | Key[] | undefined>(props.defaultValue);
const value = computed<Key | Key[] | undefined>(() =>
  props.modelValue !== undefined ? props.modelValue : internalValue.value,
);

// —— 树数据：options 变更即重建；值中的失效 key 经 getNode 静默忽略 ——
const treeMate = computed(() => createTreeMate(props.options, { ignoreEmptyChildren: true }));

const internalExpanded = ref<Key[]>(
  props.defaultExpandAll
    ? treeMate.value.getNonLeafKeys({ preserveGroup: true })
    : [...props.defaultExpandedKeys],
);
const expandedKeys = computed<Key[]>(() => props.expandedKeys ?? internalExpanded.value);

// defaultExpandAll 只在 options 首次非空时播种：首次计算时异步数据通常还是空树
let expandAllSeeded = !props.defaultExpandAll || treeMate.value.treeNodes.length > 0;
watch(
  () => props.options,
  () => {
    if (expandAllSeeded || !props.defaultExpandAll || props.expandedKeys !== undefined) return;
    if (treeMate.value.treeNodes.length === 0) return;
    expandAllSeeded = true;
    internalExpanded.value = treeMate.value.getNonLeafKeys({ preserveGroup: true });
  },
);

function handleExpandedUpdate(keys: Key[]) {
  internalExpanded.value = keys;
  emit("update:expandedKeys", keys);
}

function toggleNode(node: TreeNode) {
  const next = expandedKeys.value.includes(node.key)
    ? expandedKeys.value.filter((k) => k !== node.key)
    : [...expandedKeys.value, node.key];
  handleExpandedUpdate(next);
}

function toArrayValue(v: Key | Key[] | undefined): Key[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// checkable 值语义恒为数组：单值 Key 输入按无选中处理并 dev 警告一次
let warnedNonArrayValue = false;
function normalizeValue(v: Key | Key[] | undefined): Key[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  if (props.checkable) {
    if (import.meta.env?.DEV && !warnedNonArrayValue) {
      warnedNonArrayValue = true;
      console.warn("[TreeSelect] checkable 模式下 modelValue 需为数组，单值输入已按无选中处理。");
    }
    return [];
  }
  return [v];
}

const selectedKeys = computed<Key[]>(() => toArrayValue(value.value));

const checkOptions = computed(() => ({
  cascade: props.cascade,
  checkStrategy: props.checkStrategy,
}));

// 勾选模式的展示状态（级联归一后的选中/半选集合）
const checkedState = computed<{ checked: Key[]; indeterminate: Key[] }>(() => {
  if (!props.checkable) return { checked: selectedKeys.value, indeterminate: [] };
  const merged = treeMate.value.getCheckedKeys(normalizeValue(value.value), checkOptions.value);
  return { checked: merged.checkedKeys, indeterminate: merged.indeterminateKeys };
});

const tags = computed<TreeSelectTag[]>(() =>
  selectedKeys.value
    .map((key) => {
      const node = treeMate.value.getNode(key);
      return node ? { key, label: (node.rawNode as TreeOption).label ?? String(key) } : null;
    })
    .filter((t): t is TreeSelectTag => t !== null),
);

// checkable 隐含多选语义（值恒为 Key[]，与 multiple 等价）
const isMulti = computed(() => props.multiple || props.checkable);

const singleLabel = computed(() => (isMulti.value ? "" : (tags.value[0]?.label ?? "")));

function updateValue(next: Key | Key[] | undefined) {
  internalValue.value = next;
  emit("update:modelValue", next);
}

function selectNode(node: TreeNode) {
  if (node.disabled) return;
  if (props.checkable) {
    const current = normalizeValue(value.value);
    const isNodeChecked = checkedState.value.checked.includes(node.key);
    const merged = isNodeChecked
      ? treeMate.value.uncheck(node.key, current, checkOptions.value)
      : treeMate.value.check(node.key, current, checkOptions.value);
    updateValue(merged.checkedKeys);
    return;
  }
  if (props.multiple) {
    const current = toArrayValue(value.value);
    const next = current.includes(node.key)
      ? current.filter((k) => k !== node.key)
      : [...current, node.key];
    updateValue(next);
  } else {
    updateValue(node.key);
    setOpen(false);
  }
}

// checkStrategy / cascade 运行时切换：值集合按新策略归一
watch(checkOptions, () => {
  if (!props.checkable) return;
  const normalized = treeMate.value.getCheckedKeys(normalizeValue(value.value), checkOptions.value);
  const current = toArrayValue(value.value);
  if (
    normalized.checkedKeys.length !== current.length ||
    normalized.checkedKeys.some((k) => !current.includes(k))
  ) {
    updateValue(normalized.checkedKeys);
  }
});

function removeTag(key: Key) {
  if (props.checkable) {
    const merged = treeMate.value.uncheck(key, normalizeValue(value.value), checkOptions.value);
    updateValue(merged.checkedKeys);
    return;
  }
  updateValue(toArrayValue(value.value).filter((k) => k !== key));
}

const hasValue = computed(() => tags.value.length > 0);

function handleClear() {
  const next = isMulti.value ? [] : undefined;
  internalValue.value = next;
  emit("update:modelValue", next);
}

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

const visibleNodes = computed(() => treeMate.value.getFlattenedNodes(expandedKeys.value));

// —— 过滤：命中节点及其祖先路径可见（搜索态下全树展开）——
const pattern = ref("");
const searchPattern = computed(() => pattern.value.trim().toLowerCase());
const filteredNodes = computed<TreeNode[]>(() => {
  if (!props.filterable || !searchPattern.value) return visibleNodes.value;
  const mate = treeMate.value;
  // 命中节点与其全部祖先均保留（祖先自身无命中也保留）
  const keep = new Set<Key>();
  const allNodes = mate.getFlattenedNodes(mate.getNonLeafKeys({ preserveGroup: true }));
  for (const node of allNodes) {
    const path = mate.getPath(node.key);
    if (path.treeNodePath.some((tn) => labelOf(tn).toLowerCase().includes(searchPattern.value))) {
      path.treeNodePath.forEach((tn) => keep.add(tn.key));
    }
  }
  return allNodes.filter((n) => keep.has(n.key));
});

function labelOf(node: TreeNode): string {
  return (node.rawNode as TreeOption).label ?? String(node.key);
}

// —— 键盘导航（↑↓←→ / Home / End / Enter，游标仅落在非 disabled 节点）——
const activeKey = ref<Key | null>(null);
const MOVE_KEYS: MoveKey[] = ["ArrowDown", "ArrowUp", "Home", "End"];

function scrollActiveIntoView() {
  nextTick(() => {
    document
      .querySelector('[data-part="tree-node"][data-active]')
      ?.scrollIntoView?.({ block: "nearest" });
  });
}

function moveHorizontally(expand: boolean) {
  if (activeKey.value === null) return;
  const node = filteredNodes.value.find((n) => n.key === activeKey.value);
  if (!node) return;
  if (expand) {
    if (node.isLeaf || !node.children?.length) return;
    if (!expandedKeys.value.includes(node.key)) {
      handleExpandedUpdate([...expandedKeys.value, node.key]);
      return;
    }
    const firstChild = node.children.find((c) => !c.disabled);
    if (firstChild) activeKey.value = firstChild.key;
  } else {
    if (node.children?.length && expandedKeys.value.includes(node.key)) {
      handleExpandedUpdate(expandedKeys.value.filter((k) => k !== node.key));
      return;
    }
    if (node.parent && !node.parent.ignored) activeKey.value = node.parent.key;
  }
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
    activeKey.value = nextActiveKey(filteredNodes.value, activeKey.value, e.key as MoveKey);
    scrollActiveIntoView();
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    moveHorizontally(e.key === "ArrowRight");
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const node = filteredNodes.value.find((n) => n.key === activeKey.value);
    if (node) selectNode(node);
  }
}

// 弹层开合时重置键盘游标与搜索词
watch(isOpen, (open) => {
  activeKey.value = null;
  if (open) syncPanelWidth();
  else pattern.value = "";
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
          <input
            v-if="props.filterable"
            v-model="pattern"
            data-part="input"
            type="text"
            class="h-5 w-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            :placeholder="tags.length ? '' : props.placeholder"
            :aria-label="props.placeholder"
          />
          <span v-if="!tags.length && !props.filterable" class="truncate text-muted-foreground">{{
            props.placeholder
          }}</span>
        </template>
        <template v-else>
          <input
            v-if="props.filterable"
            v-model="pattern"
            data-part="input"
            type="text"
            class="h-full w-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            :placeholder="singleLabel || props.placeholder"
            :aria-label="props.placeholder"
          />
          <template v-else>
            <span v-if="singleLabel" class="truncate">{{ singleLabel }}</span>
            <span v-else class="truncate text-muted-foreground">{{ props.placeholder }}</span>
          </template>
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

    <!-- 弹层 Teleport：脱离表单 DOM，消除 overflow 容器裁剪隐患（DatePicker 同款）；
         目标经沙箱适配降级（shadow DOM / wujie graft → 应用挂载容器） -->
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
          <TreePanel
            :nodes="filteredNodes"
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            :active-key="activeKey"
            :checkable="props.checkable"
            :checked-keys="checkedState.checked"
            :indeterminate-keys="checkedState.indeterminate"
            @select="selectNode"
            @toggle="toggleNode"
          />
        </ArkPopover.Content>
      </ArkPopover.Positioner>
    </Teleport>
  </ArkPopover.Root>
</template>
