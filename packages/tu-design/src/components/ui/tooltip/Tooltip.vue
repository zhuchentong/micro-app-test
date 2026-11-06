<script setup lang="ts">
import type { PropType } from "vue";
import { computed, useAttrs, useSlots } from "vue";
import { Tooltip as ArkTooltip } from "@ark-ui/vue/tooltip";
import type { TooltipRootProps } from "@ark-ui/vue/tooltip";
import { cn } from "../../../lib/utils";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useOverlayIds } from "../overlay-shared/useOverlayIds";
import { withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";

// ids 全量覆盖（无冒号）：规避 wujie patch getElementById 对 zag 缺省冒号 id 的
// SyntaxError 刷屏（详注见 useOverlayIds）
const { ids: rootIds } = useOverlayIds(useAttrs(), {
  primary: "content",
  parts: ["content", "trigger", "positioner", "arrow"],
});

const props = defineProps({
  /** 提示文字；#content 插槽可覆盖以渲染富内容 */
  content: { type: String, default: undefined },
  /** 受控开关（配合 v-model:open）；不传时为非受控 */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  /** 悬停多久后显示（毫秒） */
  delayDuration: { type: Number, default: undefined },
  /** 移开后多久隐藏（毫秒） */
  closeDuration: { type: Number, default: undefined },
  lazyMount: { type: Boolean, default: false },
  unmountOnExit: { type: Boolean, default: false },
  /** 追加/覆盖气泡样式（经 cn 合并） */
  contentClass: { type: String, default: undefined },
  /** 透传到气泡 Content 的属性对象（id、data-*、事件监听等） */
  contentProps: {
    type: Object as PropType<Record<string, unknown>>,
    default: undefined,
  },
  /** Ark Tooltip Root 的 positioning 配置（placement/gutter 等）；
      iframe realm（wujie graft / iframe 嵌入）下 strategy 未显式指定时默认 fixed
      （absolute 包含块错位修正，机制详注见 useSandboxOverlay / sandbox.ts） */
  positioning: {
    type: Object as PropType<TooltipRootProps["positioning"]>,
    default: undefined,
  },
});

const emit = defineEmits<{ "update:open": [open: boolean] }>();

const slots = useSlots();

// open 用 default: undefined 禁用 Boolean casting，保证「未传」可辨（Dialog 同款约定）
// 对 Root 恒走受控模式，非受控语义由内部 ref 实现（Dialog 同款）
const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => emit("update:open", open),
});

// 沙箱适配（机制详注见 useSandboxOverlay / sandbox.ts）：面板无 Teleport 留原地，
// iframe realm 下 strategy 默认 fixed 消除 absolute 包含块（最近 positioned 祖先）错位
const rootPositioning = computed(() =>
  withSandboxStrategy(props.positioning, { ...props.positioning }),
);
</script>

<template>
  <ArkTooltip.Root
    :ids="rootIds"
    :open="isOpen"
    :open-delay="props.delayDuration"
    :close-delay="props.closeDuration"
    :lazy-mount="props.lazyMount"
    :unmount-on-exit="props.unmountOnExit"
    :positioning="rootPositioning"
    @update:open="setOpen"
  >
    <!-- 默认插槽即触发元素本身：Ark Trigger asChild 把行为（hover/focus、aria）合并其上，
       不额外包裹元素。省略默认插槽即为纯受控气泡（open 驱动，配合 #content） -->
    <ArkTooltip.Trigger v-if="slots.default" as-child>
      <slot />
    </ArkTooltip.Trigger>

    <ArkTooltip.Positioner class="z-[var(--z-overlay)]">
      <ArkTooltip.Content
        v-bind="props.contentProps"
        :class="
          cn(
            'bg-primary text-primary-foreground z-[var(--z-overlay)] w-fit rounded-md px-3 py-1.5 text-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            props.contentClass,
          )
        "
      >
        <slot name="content">{{ props.content }}</slot>
      </ArkTooltip.Content>
    </ArkTooltip.Positioner>
  </ArkTooltip.Root>
</template>
