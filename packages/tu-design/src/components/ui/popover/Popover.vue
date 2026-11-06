<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { PropType } from "vue";
import { computed, onBeforeUnmount, useAttrs, useSlots } from "vue";
import type { PopoverRootProps } from "@ark-ui/vue/popover";
import { Popover as ArkPopover } from "@ark-ui/vue/popover";
import { cn } from "../../../lib/utils";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useOverlayIds } from "../overlay-shared/useOverlayIds";
import { useSandboxTeleportTarget, withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";

/** 面板相对触发器的对齐方向 */
type Align = "start" | "center" | "end";
/** 面板主轴方向（与 align 组合成 12 方位 placement） */
type Side = "top" | "bottom" | "left" | "right";
/** 触发方式：click 内建切换；hover/focus 延迟桥接；manual 纯受控 */
type TriggerMode = "click" | "hover" | "focus" | "manual";

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
  /** 触发方式：click(默认，内建切换+完整 aria) / hover / focus(带延迟，Anchor+手动 aria) / manual(纯受控，仅定位锚点) */
  trigger: { type: String as PropType<TriggerMode>, default: "click" },
  /** hover/focus 打开延迟（毫秒） */
  openDelay: { type: Number, default: 100 },
  /** hover/focus 关闭延迟（毫秒） */
  closeDelay: { type: Number, default: 100 },
  /** hover/focus 时悬浮/聚焦面板保持打开 */
  keepAliveOnHover: { type: Boolean, default: true },
  /** 面板主轴方向（与 align 组合定位）；attrs.positioning.placement 显式给出时以其为准 */
  side: { type: String as PropType<Side>, default: "bottom" },
  /** 面板相对触发器的对齐方向（默认居中） */
  align: { type: String as PropType<Align>, default: "center" },
  /** 显示箭头（shadcn 风格默认无箭头） */
  arrow: { type: Boolean, default: false },
  /** 追加/覆盖箭头样式类 */
  arrowClass: { type: String, default: undefined },
  /** 禁用触发（不响应任何触发事件；已打开状态不受影响） */
  disabled: { type: Boolean, default: false },
  /** 是否 Teleport（浮层定位不受嵌套裁剪影响）；false 时面板留在原地 */
  portal: { type: Boolean, default: true },
  /** Teleport 目标（选择器或元素），仅 portal=true 时生效；
      缺省时若应用挂载容器处于 shadow DOM 或 wujie graft 沙箱，自动降级为该容器，否则 body */
  to: { type: [String, Object] as PropType<string | HTMLElement>, default: undefined },
  /** 面板宽度与触发元素一致 */
  matchTriggerWidth: { type: Boolean, default: false },
  /** 覆盖面板/定位层级（默认走 --z-overlay） */
  zIndex: { type: Number, default: undefined },
  /** 追加/覆盖面板样式类（默认 w-72 可由此覆盖，如 "w-56 p-0"） */
  contentClass: { type: String, default: undefined },
  /** 透传到面板根元素上的属性（id/style/data-* 等，class 请用 contentClass） */
  contentProps: { type: Object as PropType<Record<string, unknown>>, default: undefined },
});

const emit = defineEmits<{ "update:open": [open: boolean] }>();

const slots = useSlots();
const attrs = useAttrs();

// —— Teleport 目标解析：显式 to > shadow DOM / wujie graft 自动降级 > body ——
// 机制详注见 useSandboxTeleportTarget（Popover 0.5.3 沙箱修复的公共层抽离）
const teleportTarget = useSandboxTeleportTarget(() => props.to);

// —— 受控桥接（Dialog 同款）：Root 恒走受控，非受控语义由内部 ref 实现 ——
const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => emit("update:open", open),
});

// —— 触发路径分派：click 用内建 Trigger（完整 aria 自动接线）；
// hover/focus/manual 用 Anchor 作定位锚点（无内建 click，语义不冲突）。
// disabled 时也切 Anchor：内建 TOGGLE 无法从外部短路（AT_TARGET 阶段监听器按注册顺序
// 执行、capture 无优先级），不渲染 Trigger 是唯一可靠方式 ——
const useNativeTrigger = computed(() => props.trigger === "click" && !props.disabled);

// —— Anchor 模式的手动 aria 接线（补偿放弃 Trigger 的自动接线）——
// —— ids 全量覆盖（无冒号）详注见 useOverlayIds（wujie patch getElementById
// 对 zag 缺省冒号 id `popover:{id}:*` 每次查询抛 SyntaxError 刷警告）；
// trigger 为静态 id，仅支持单触发器（本 wrapper 只渲染单个 Trigger/Anchor）——
const { ids: rootIds, resolveId } = useOverlayIds(attrs, {
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
const anchorAria = computed(() =>
  useNativeTrigger.value
    ? {}
    : {
        "aria-haspopup": "dialog" as const,
        "aria-expanded": isOpen.value,
        "aria-controls": resolveId("content"), // user 覆盖优先，与面板实际 id 一致
      },
);

// —— 延迟桥接（hover/focus）：单一定时器，进入取消关闭、离开取消打开 ——
let timer: ReturnType<typeof setTimeout> | null = null;
const clearTimer = () => {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
};
const schedule = (next: boolean, delay: number) => {
  if (props.disabled) return;
  clearTimer();
  if (delay <= 0) {
    setOpen(next);
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    if (!props.disabled) setOpen(next);
  }, delay);
};

const isHoverFocus = () => props.trigger === "hover" || props.trigger === "focus";

const onTriggerEnter = () => {
  if (!isHoverFocus()) return;
  schedule(true, props.openDelay);
};
const onTriggerLeave = () => {
  if (!isHoverFocus()) return;
  schedule(false, props.closeDelay);
};
// 面板悬浮/聚焦保活（keep-alive 语义）：仅取消挂起的关闭计时
const onPanelEnter = () => {
  if (!isHoverFocus() || !props.keepAliveOnHover) return;
  clearTimer();
};
// 离开面板（去往触发器以外的地方）也应关闭：覆盖 trigger→panel→outside 链路
const onPanelLeave = () => {
  if (!isHoverFocus()) return;
  schedule(false, props.closeDelay);
};

onBeforeUnmount(clearTimer);

// side/align → Ark positioning.placement（12 方位，居中不带对齐后缀）；
// 外部经 attrs 传入的 positioning 已显式指定 placement 时以其为准，其余字段原样合并。
// iframe realm 下 strategy 默认 fixed（absolute 包含块错位修正），机制详注见
// withSandboxStrategy / overlay-shared/sandbox.ts —— 沙箱修复的公共层抽离
const rootPositioning = computed<ArkPositioning>(() => {
  const user = (attrs.positioning ?? {}) as ArkPositioning;
  const placement = (
    props.align === "center" ? props.side : `${props.side}-${props.align}`
  ) as ArkPlacement;
  return withSandboxStrategy(user, {
    ...user,
    placement,
    sameWidth: props.matchTriggerWidth || user.sameWidth,
  });
});

// 面板样式：内置类 + contentClass + contentProps.class 三方合并（twMerge 自动去冲突，后者优先）
const contentClass = computed(() =>
  cn(
    "bg-popover text-popover-foreground z-[var(--z-overlay)] w-72 rounded-md border p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
    props.contentClass,
    props.contentProps?.["class"] as ClassValue,
  ),
);

// 箭头：尺寸/底色经 CSS 变量交给 zag 内联样式（arrowTip 自动取 --arrow-background 上色）
const arrowClass = computed(() =>
  cn("[--arrow-size:10px] [--arrow-background:var(--popover)]", props.arrowClass),
);

// zIndex prop 走内联 style（Tailwind 任意值类不适合动态拼接）；未传保持默认层级类
const positionerClass = computed(() => (props.zIndex != null ? "" : "z-[var(--z-overlay)]"));
const positionerStyle = computed(() =>
  props.zIndex != null ? { zIndex: props.zIndex } : undefined,
);
</script>

<template>
  <ArkPopover.Root
    v-bind="attrs"
    :open="isOpen"
    :positioning="rootPositioning"
    :ids="rootIds"
    :lazy-mount="props.lazyMount"
    :unmount-on-exit="props.unmountOnExit"
    @update:open="setOpen"
  >
    <!-- click 且未禁用：内建 Trigger，行为/aria 与旧版完全一致 -->
    <ArkPopover.Trigger v-if="useNativeTrigger" as-child>
      <slot />
    </ArkPopover.Trigger>

    <!-- hover/focus/manual 或 disabled：Anchor + 自绑监听 + 手动 aria -->
    <ArkPopover.Anchor
      v-else-if="slots.default"
      as-child
      v-bind="anchorAria"
      @mouseenter="onTriggerEnter"
      @mouseleave="onTriggerLeave"
      @focusin="onTriggerEnter"
      @focusout="onTriggerLeave"
    >
      <slot />
    </ArkPopover.Anchor>

    <!-- portal：Teleport（Ark Vue 原语不自带传送，浮层定位不受嵌套 overflow 裁剪影响）；
         portal=false 时 disabled Teleport 面板留在原地；to 显式指定目标，
         缺省时真 shadow DOM（getRootNode 检测）与 wujie graft（marker 检测）沙箱
         自动降级为应用挂载容器，避免传送出 shadow root -->
    <Teleport :to="teleportTarget" :disabled="!props.portal">
      <ArkPopover.Positioner :class="positionerClass" :style="positionerStyle">
        <ArkPopover.Content
          v-bind="props.contentProps"
          :class="contentClass"
          @mouseenter="onPanelEnter"
          @mouseleave="onPanelLeave"
          @focusin="onPanelEnter"
          @focusout="onPanelLeave"
        >
          <ArkPopover.Arrow v-if="props.arrow" :class="arrowClass">
            <ArkPopover.ArrowTip />
          </ArkPopover.Arrow>
          <slot name="header" />
          <slot name="content" />
          <slot name="footer" />
        </ArkPopover.Content>
      </ArkPopover.Positioner>
    </Teleport>
  </ArkPopover.Root>
</template>
