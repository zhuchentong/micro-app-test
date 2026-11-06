<script setup lang="ts">
import type { DateValue } from "@ark-ui/vue/date-picker";
import { DatePicker as ArkDatePicker } from "@ark-ui/vue/date-picker";
import type { PropType } from "vue";
import { computed, provide, shallowRef, watch } from "vue";
import { cn } from "../../../lib/utils";
import { Calendar as TCalendar } from "../calendar";
import CalendarIcon from "../icon-shared/CalendarIcon.vue";
import CloseIcon from "../icon-shared/CloseIcon.vue";
import {
  CALENDAR_IN_PICKER,
  controlCls,
  formatIsoDate,
  iconBtnCls,
  parseIsoDate,
  parseIsoRange,
} from "../date-shared/shared";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";
import { useSandboxTeleportTarget, withSandboxStrategy } from "../overlay-shared/useSandboxOverlay";
import type { PickerPositioning } from "../date-shared/positioning";

const props = defineProps({
  /** 受控值 [start, end]（"yyyy-MM-dd"，start ≤ end）；undefined 走内部非受控，null 表示空 */
  modelValue: {
    type: Array as unknown as PropType<[string, string] | null | undefined>,
    default: undefined,
  },
  defaultValue: {
    type: Array as unknown as PropType<[string, string] | undefined>,
    default: undefined,
  },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  placeholder: { type: String, default: "请选择日期范围" },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  readOnly: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 可选下界（"yyyy-MM-dd"，含当日） */
  min: { type: String, default: undefined },
  /** 可选上界（"yyyy-MM-dd"，含当日） */
  max: { type: String, default: undefined },
  /** 不可选日期谓词（参数为 ark 的 DateValue） */
  isDateUnavailable: {
    type: Function as PropType<(date: DateValue) => boolean>,
    default: undefined,
  },
  /** 选完终点后是否自动关弹层 */
  closeOnSelect: { type: Boolean, default: true },
  /** 日视图并排月数 */
  numOfMonths: { type: Number, default: 2 },
  /** 文案与周起点跟随 locale（zh-CN 默认周一起始） */
  locale: { type: String, default: "zh-CN" },
  /** Ark DatePicker Root 的 positioning 配置（placement/gutter 等）；
      iframe realm（wujie graft / iframe 嵌入）下 strategy 未显式指定时默认 fixed */
  positioning: {
    type: Object as PropType<PickerPositioning>,
    default: undefined,
  },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{
  "update:modelValue": [value: [string, string] | null];
  "update:open": [open: boolean];
}>();

// attrs（id/aria-*）转发给真实 input，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

// 弹层内的 TCalendar 探测到宿主标记 → embedded 内嵌形态（纯卡片内核，不自建 Root，值归本 Picker）
provide(CALENDAR_IN_PICKER, true);

// —— 受控桥接（mirror 模式）——
// range 是两步交互：zag 受控模式下内部值读 prop，父组件回显滞后会吃掉 pending start，
// 导致第二次点击永远变成新起点。因此恒以内部镜像（zag 原生 0–2 元素 DateValue[]）为准，
// 外部 modelValue 赋值经 watch 覆盖 mirror；对外 emit 归一为 [ISO, ISO] | null。
// shallowRef：internalValue 恒整体替换/读取，且规避 ref 深层 unwrap 把 DateValue
// 类联合展开成结构类型（ZonedDateTime 丢 #private）导致 vue-tsc 不再匹配 DateValue[]
const internalValue = shallowRef<DateValue[]>([]);
const rootValue = computed(() => internalValue.value);

function normalize(next: DateValue[]): [string, string] | null {
  return next.length === 2 ? [formatIsoDate(next[0]), formatIsoDate(next[1])] : null;
}

function handleValueUpdate(next: DateValue[]) {
  internalValue.value = next;
  emit("update:modelValue", normalize(next));
}

function sameTuple(a: [string, string] | null, b: [string, string] | null | undefined): boolean {
  if (a === null || b === undefined) return a === null && (b === null || b === undefined);
  return Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
}

watch(
  () => props.modelValue,
  (v) => {
    // 回环守卫：emit 值原样回流（含 pending 期父组件回传 null）则跳过，避免打断选择
    if (sameTuple(normalize(internalValue.value), v)) return;
    internalValue.value = parseIsoRange(v) ?? [];
  },
  { immediate: true },
);

// 非受控初值（modelValue 未传时以 defaultValue 种子）
if (props.modelValue === undefined && props.defaultValue) {
  internalValue.value = parseIsoRange(props.defaultValue) ?? [];
}

const minDate = computed(() => parseIsoDate(props.min ?? ""));
const maxDate = computed(() => parseIsoDate(props.max ?? ""));

const { isOpen, setOpen } = useControlledBoolean({
  controlled: () => props.open,
  defaultValue: () => props.defaultOpen,
  onChange: (open) => emit("update:open", open),
});

// —— 沙箱适配（机制详注见 useSandboxOverlay / sandbox.ts）：Teleport 目标降级
// （shadow DOM / wujie graft → 应用挂载容器，避免面板落入 iframe body）+
// iframe realm 下 strategy 默认 fixed（absolute 包含块错位，fixed 唯一正确解）；
// 无 to prop，面板恒传送 ——
const teleportTarget = useSandboxTeleportTarget(() => undefined);
const rootPositioning = computed(() =>
  withSandboxStrategy(props.positioning, { ...props.positioning }),
);

// 点击/键盘 ↓ 输入框即开弹层（zag 默认仅 Trigger 开，openOnClick prop 默认关闭；
// 显式驱动保证各环境行为一致并显式走受控 emit）
function openFromInput() {
  if (props.disabled || props.readOnly || isOpen.value) return;
  setOpen(true);
}
</script>

<template>
  <!-- outside-day-selectable：zag getDayTableCellState 的 getUnitDuration 把 months 强制置 1，
       多月视图下第二月起所有当月格被误判 outside-range 而禁用；此开关对冲（见 calendar/CalendarBody 注释） -->
  <ArkDatePicker.Root
    :model-value="rootValue"
    selection-mode="range"
    :num-of-months="props.numOfMonths"
    outside-day-selectable
    :open="isOpen"
    :locale="props.locale"
    :min="minDate"
    :max="maxDate"
    :is-date-unavailable="props.isDateUnavailable"
    :close-on-select="props.closeOnSelect"
    :read-only="props.readOnly"
    :disabled="props.disabled"
    :format="formatIsoDate"
    :parse="parseIsoDate"
    :positioning="rootPositioning"
    @update:model-value="handleValueUpdate"
    @update:open="setOpen"
  >
    <ArkDatePicker.Control
      :class="cn(controlCls, props.class)"
      :data-invalid="props.invalid ? '' : undefined"
    >
      <ArkDatePicker.Input
        v-bind="$attrs"
        :index="0"
        :placeholder="props.placeholder"
        :aria-invalid="props.invalid || undefined"
        class="bg-transparent h-full w-full min-w-0 flex-1 px-3 text-sm tabular-nums outline-none"
        @click="openFromInput"
        @keydown.down.prevent="openFromInput"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-muted-foreground size-3.5 shrink-0"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
      <ArkDatePicker.Input
        :index="1"
        :placeholder="props.placeholder"
        :aria-invalid="props.invalid || undefined"
        class="bg-transparent h-full w-full min-w-0 flex-1 px-3 text-sm tabular-nums outline-none"
        @click="openFromInput"
        @keydown.down.prevent="openFromInput"
      />
      <ArkDatePicker.ClearTrigger :class="iconBtnCls">
        <CloseIcon class="size-4" />
      </ArkDatePicker.ClearTrigger>
      <ArkDatePicker.Trigger :class="iconBtnCls">
        <CalendarIcon class="size-4" />
      </ArkDatePicker.Trigger>
    </ArkDatePicker.Control>

    <!-- 弹层 Teleport：脱离表单 DOM——隔离外层 FormControl 的 group class
       （group-hover 会污染面板内全部格子），并消除 overflow 容器裁剪弹层的隐患；
       目标经沙箱适配降级（shadow DOM / wujie graft → 应用挂载容器） -->
    <Teleport :to="teleportTarget">
      <ArkDatePicker.Positioner class="z-[var(--z-overlay)]">
        <ArkDatePicker.Content
          :class="
            cn(
              'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-[var(--z-overlay)] rounded-md border shadow-md',
            )
          "
        >
          <TCalendar :num-of-months="props.numOfMonths" />
        </ArkDatePicker.Content>
      </ArkDatePicker.Positioner>
    </Teleport>
  </ArkDatePicker.Root>
</template>
