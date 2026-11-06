<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref, useAttrs } from "vue";
import { createListCollection } from "@ark-ui/vue/collection";
import { Select as ArkSelect } from "@ark-ui/vue/select";
import type { SelectRootProps } from "@ark-ui/vue/select";
import { cn } from "../../../lib/utils";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useOverlayIds } from "../overlay-shared/useOverlayIds";
import { withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";
import { normalizeSelectItem, type SelectItemOption } from "./types";

// ids 全量覆盖（无冒号）：规避 wujie patch getElementById 对 zag 缺省冒号 id 的
// SyntaxError 刷屏（详注见 useOverlayIds）。函数型 item/itemGroup/itemGroupLabel
// 不覆盖（元素必渲染无炸点，user 经 attrs.ids 直传保留）
const { ids: rootIds } = useOverlayIds(useAttrs(), {
  primary: "content",
  parts: [
    "content",
    "root",
    "trigger",
    "control",
    "clearTrigger",
    "label",
    "hiddenSelect",
    "positioner",
  ],
});

// modelValue 为 String 类型无 Boolean casting 问题；「未传」经 default: undefined 保持 undefined
const props = defineProps({
  /** 选项列表：字符串（label = value）或 { label, value, disabled? } */
  items: { type: Array as PropType<(string | SelectItemOption)[]>, required: true },
  /** 当前值（配合 v-model）；不传时为非受控 */
  modelValue: { type: String as PropType<string | undefined>, default: undefined },
  defaultValue: { type: String, default: undefined },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  /** 未选中时触发器显示的占位文案 */
  placeholder: { type: String, default: "请选择" },
  /** 透传合并到触发器（Trigger）的 class */
  triggerClass: { type: String, default: undefined },
  /** 透传合并到弹层（Content）的 class */
  contentClass: { type: String, default: undefined },
  /** Ark Select Root 的 positioning 配置（placement/gutter 等）；
      iframe realm（wujie graft / iframe 嵌入）下 strategy 未显式指定时默认 fixed
      （absolute 包含块错位修正，机制详注见 useSandboxOverlay / sandbox.ts） */
  positioning: {
    type: Object as PropType<SelectRootProps<string | SelectItemOption[]>["positioning"]>,
    default: undefined,
  },
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:open": [open: boolean];
}>();

// zag select 的 value 内部统一为数组，这里保持单选 string 的公开语义
const toArray = (v: string | undefined) => (v === undefined ? undefined : [v]);

// 对 Root 恒走受控模式（DatePicker 同款）：非受控语义由内部 ref 实现
const internalValue = ref<string | undefined>(props.defaultValue);
const modelValue = computed(() => props.modelValue ?? internalValue.value);

// 一次归一化（string → { label, value }），v-for 与 #item 插槽作用域共用
const normalizedItems = computed(() =>
  props.items.map((raw) => ({ raw, item: normalizeSelectItem(raw) })),
);

const collection = computed(() =>
  createListCollection({
    items: normalizedItems.value.map((entry) => entry.item),
    isItemDisabled: (item) => item.disabled === true,
  }),
);

function handleModelUpdate(next: string | string[]) {
  const value = Array.isArray(next) ? next[0]! : next;
  internalValue.value = value;
  emit("update:modelValue", value);
}

const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => emit("update:open", open),
});

// 沙箱适配（机制详注见 useSandboxOverlay / sandbox.ts）：面板无 Teleport 留原地，
// iframe realm 下 strategy 默认 fixed 消除 absolute 包含块（最近 positioned 祖先）错位。
// 弹层与触发器同宽（zag popper：Positioner width = var(--reference-width)，size middleware
// 恰在 sameWidth 启用时激活；机制先例见 Popover matchTriggerWidth）。
// spread 顺序保证用户显式传 positioning.sameWidth 时以其为准。
const rootPositioning = computed(() =>
  withSandboxStrategy(props.positioning, { sameWidth: true, ...props.positioning }),
);
</script>

<template>
  <ArkSelect.Root
    :ids="rootIds"
    :collection="collection"
    :model-value="toArray(modelValue)"
    :open="isOpen"
    :positioning="rootPositioning"
    @update:model-value="handleModelUpdate"
    @update:open="setOpen"
  >
    <!-- 触发器（收编自 SelectTrigger：内置选中回显与 chevron） -->
    <ArkSelect.Control class="w-full">
      <ArkSelect.Trigger
        :class="
          cn(
            'border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs focus-visible:outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
            props.triggerClass,
          )
        "
      >
        <!-- 截断层：触发器 w-full 定宽后，超长选中值/placeholder 走 ellipsis（flex 子项 overflow 非 visible 时自动最小尺寸归零，min-w-0 双保险）。
             注意：不能向 ValueText 传插槽内容，其内部会对默认插槽做字符串化渲染 -->
        <span class="min-w-0 flex-1 truncate">
          <ArkSelect.ValueText :placeholder="props.placeholder" />
        </span>
        <slot name="trigger-icon"><ChevronIcon class="size-4 rotate-90 opacity-50" /></slot>
      </ArkSelect.Trigger>
    </ArkSelect.Control>

    <ArkSelect.Positioner class="z-[var(--z-overlay)]">
      <ArkSelect.Content
        :class="
          cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-[var(--z-overlay)] max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md',
            props.contentClass,
          )
        "
      >
        <ArkSelect.Item
          v-for="entry in normalizedItems"
          :key="entry.item.value"
          :item="entry.item"
          class="data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
        >
          <slot
            name="item"
            :item="entry.raw"
            :label="entry.item.label"
            :selected="entry.item.value === modelValue"
          >
            <ArkSelect.ItemText class="truncate">{{ entry.item.label }}</ArkSelect.ItemText>
            <ArkSelect.ItemIndicator class="absolute right-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="size-4"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </ArkSelect.ItemIndicator>
          </slot>
        </ArkSelect.Item>
      </ArkSelect.Content>
    </ArkSelect.Positioner>
  </ArkSelect.Root>
</template>
