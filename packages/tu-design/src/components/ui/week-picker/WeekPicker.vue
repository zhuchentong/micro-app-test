<script setup lang="ts">
import type { DateValue } from "@ark-ui/vue/date-picker";
import type { PickerPositioning } from "../date-shared/positioning";
import type { PropType } from "vue";
import { computed, provide } from "vue";
import { Calendar as TCalendar } from "../calendar";
import PickerShell from "../date-shared/PickerShell.vue";
import {
  CALENDAR_IN_PICKER,
  formatIsoWeek,
  parseIsoDate,
  weekStartOf,
} from "../date-shared/shared";
import { usePickerBridge } from "../date-shared/usePickerBridge";

const props = defineProps({
  /** 受控值（"yyyy-MM-dd"，语义=所在周起始日）；undefined 走内部非受控，null 表示空 */
  modelValue: { type: String as PropType<string | null | undefined>, default: undefined },
  /** 非受控初值（"yyyy-MM-dd"，内部归一到所在周起始日） */
  defaultValue: { type: String, default: undefined },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  placeholder: { type: String, default: "请选择周" },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  readOnly: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 可选下界（"yyyy-MM-dd"，含当日；日粒度，周条带可能视觉越界但不影响点选禁用） */
  min: { type: String, default: undefined },
  /** 可选上界（"yyyy-MM-dd"，含当日） */
  max: { type: String, default: undefined },
  /** 不可选日期谓词（参数为 ark 的 DateValue；命中格不可点，同周其余日仍可选） */
  isDateUnavailable: {
    type: Function as PropType<(date: DateValue) => boolean>,
    default: undefined,
  },
  /** 选中后是否自动关弹层 */
  closeOnSelect: { type: Boolean, default: true },
  /** 文案与周起点跟随 locale（zh-CN 默认周一起始） */
  locale: { type: String, default: "zh-CN" },
  /** Ark DatePicker Root 的 positioning 配置（placement/gutter 等）；
      iframe realm（wujie graft / iframe 嵌入）下 strategy 未显式指定时默认 fixed
      （absolute 包含块错位修正，机制详注见 useSandboxOverlay / sandbox.ts） */
  positioning: {
    type: Object as PropType<PickerPositioning>,
    default: undefined,
  },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
  "update:open": [open: boolean];
}>();

// attrs（id/aria-*）转发给真实 input，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

// 弹层内的 TCalendar 探测到宿主标记 → embedded 内嵌形态（纯卡片内核，不自建 Root，值归本 Picker）
provide(CALENDAR_IN_PICKER, true);

/**
 * "yyyy-MM-dd" → 归一到所在周起始日的 ISO 串（非法输入返回 undefined）
 * @param raw - 输入的 ISO 日期串
 * @returns 该日期所在周起始日的 ISO 串；解析失败返回 undefined
 */
function formatIsoWeekStart(raw: string): string | undefined {
  const date = parseIsoDate(raw);
  return date ? weekStartOf(date, props.locale).toString() : undefined;
}

const { rootValue, isOpen, setOpen, handleValueUpdate } = usePickerBridge({
  modelValue: () => props.modelValue,
  defaultValue: () => props.defaultValue,
  open: () => props.open,
  defaultOpen: () => props.defaultOpen,
  disabled: () => props.disabled,
  readOnly: () => props.readOnly,
  parse: parseIsoDate,
  normalizeDefault: (raw) => formatIsoWeekStart(raw) ?? null,
  toPublicValue: (date) => formatIsoWeekStart(date.toString()) ?? null,
  onUpdateModelValue: (value) => emit("update:modelValue", value),
  onUpdateOpen: (open) => emit("update:open", open),
});

const minDate = computed(() => parseIsoDate(props.min ?? ""));
const maxDate = computed(() => parseIsoDate(props.max ?? ""));

// 输入框回显整周区间（format 钩子按单值调用，zag 自行拼接）
function formatDate(date: DateValue): string {
  return formatIsoWeek(date, props.locale);
}

// 键入解析：任意合法日期键入归一到周起点；非法返回 undefined 由 zag 忽略
function parseDate(raw: string): DateValue | undefined {
  const date = parseIsoDate(raw);
  return date ? weekStartOf(date, props.locale) : undefined;
}
</script>

<template>
  <PickerShell
    v-bind="$attrs"
    :model-value="rootValue"
    :open="isOpen"
    :locale="props.locale"
    :min="minDate"
    :max="maxDate"
    :is-date-unavailable="props.isDateUnavailable"
    :close-on-select="props.closeOnSelect"
    :read-only="props.readOnly"
    :disabled="props.disabled"
    :invalid="props.invalid"
    :placeholder="props.placeholder"
    :positioning="props.positioning"
    :class="props.class"
    :format="formatDate"
    :parse="parseDate"
    @update:model-value="handleValueUpdate"
    @update:open="setOpen"
  >
    <TCalendar week :locale="props.locale" />
  </PickerShell>
</template>
