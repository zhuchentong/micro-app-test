<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { PropType } from "vue";
import { computed, useAttrs } from "vue";
import type { PopoverRootProps } from "@ark-ui/vue/popover";
import { Popover as ArkPopover } from "@ark-ui/vue/popover";
import { cn } from "../../../lib/utils";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";

/** 面板相对触发器的对齐方向 */
type Align = "start" | "center" | "end";

/** Ark Popover Root 的 positioning 配置（placement 含四方向 × 对齐组合） */
type ArkPositioning = NonNullable<PopoverRootProps["positioning"]>;
type ArkPlacement = NonNullable<ArkPositioning["placement"]>;

defineOptions({ inheritAttrs: false });

const props = defineProps({
  /** 受控开关（配合 v-model:open）；不传时为非受控 */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 非受控时的初始开关 */
  defaultOpen: { type: Boolean, default: false },
  /** 首次展开才挂载面板内容 */
  lazyMount: { type: Boolean, default: false },
  /** 收起时卸载面板内容 */
  unmountOnExit: { type: Boolean, default: false },
  /** 面板相对触发器的对齐方向（默认居中）；attrs.positioning.placement 显式给出时以其为准 */
  align: { type: String as PropType<Align>, default: "center" },
  /** 追加/覆盖面板样式类（默认 w-72 可由此覆盖，如 "w-56 p-0"） */
  contentClass: { type: String, default: undefined },
  /** 透传到面板根元素上的属性（id/style/data-* 等，class 请用 contentClass） */
  contentProps: { type: Object as PropType<Record<string, unknown>>, default: undefined },
});

const emit = defineEmits<{ "update:open": [open: boolean] }>();

// attrs（positioning/modal 等 Ark Root 属性）手动转发，便于与 align 合并出 positioning
const attrs = useAttrs();

// —— 受控桥接（Dialog 同款）：Root 恒走受控，非受控语义由内部 ref 实现 ——
const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => emit("update:open", open),
});

// align → Ark positioning.placement（横轴对齐，主轴默认 bottom 与 Ark 原语一致）；
// 外部经 attrs 传入的 positioning 已显式指定 placement 时以其为准，其余字段原样合并
const rootPositioning = computed<ArkPositioning>(() => {
  const user = (attrs.positioning ?? {}) as ArkPositioning;
  if (user.placement) return user;
  const placement = (props.align === "center" ? "bottom" : `bottom-${props.align}`) as ArkPlacement;
  return { ...user, placement };
});

// 面板样式：内置类 + contentClass + contentProps.class 三方合并（twMerge 自动去冲突，后者优先）
const contentClass = computed(() =>
  cn(
    "bg-popover text-popover-foreground z-[var(--z-overlay)] w-72 rounded-md border p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    props.contentClass,
    props.contentProps?.["class"] as ClassValue,
  ),
);
</script>

<template>
  <ArkPopover.Root
    v-bind="attrs"
    :open="isOpen"
    :positioning="rootPositioning"
    :lazy-mount="props.lazyMount"
    :unmount-on-exit="props.unmountOnExit"
    @update:open="setOpen"
  >
    <!-- 默认插槽即触发元素本体（asChild 语义合并到子元素，不额外包裹，原 PopoverTrigger 同款实现） -->
    <ArkPopover.Trigger as-child>
      <slot />
    </ArkPopover.Trigger>
    <ArkPopover.Positioner class="z-[var(--z-overlay)]">
      <ArkPopover.Content v-bind="props.contentProps" :class="contentClass">
        <slot name="content" />
      </ArkPopover.Content>
    </ArkPopover.Positioner>
  </ArkPopover.Root>
</template>
