<script setup lang="ts">
import type { DateValue } from "@ark-ui/vue/date-picker";
import type { PickerPositioning } from "../date-shared/positioning";
import type { PropType } from "vue";
import { computed, provide } from "vue";
import { Calendar as TCalendar } from "../calendar";
import PickerShell from "../date-shared/PickerShell.vue";
import { CALENDAR_IN_PICKER, formatIsoMonth, parseIsoMonth } from "../date-shared/shared";
import { usePickerBridge } from "../date-shared/usePickerBridge";

const props = defineProps({
  /** 受控月份（"yyyy-MM"）；undefined 走内部非受控，null 表示空 */
  modelValue: { type: String as PropType<string | null | undefined>, default: undefined },
  /** 非受控初值（"yyyy-MM"） */
  defaultValue: { type: String, default: undefined },
  /** 弹层开合受控；undefined 走内部非受控（default: undefined 禁用 Boolean casting） */
  open: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultOpen: { type: Boolean, default: false },
  placeholder: { type: String, default: "请选择月份" },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  readOnly: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 可选下界（"yyyy-MM"，含当月） */
  min: { type: String, default: undefined },
  /** 可选上界（"yyyy-MM"，含当月） */
  max: { type: String, default: undefined },
  /** 选中后是否自动关弹层 */
  closeOnSelect: { type: Boolean, default: true },
  /** 文案与周起点跟随 locale */
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

const { rootValue, isOpen, setOpen, handleValueUpdate } = usePickerBridge({
  modelValue: () => props.modelValue,
  defaultValue: () => props.defaultValue,
  open: () => props.open,
  defaultOpen: () => props.defaultOpen,
  disabled: () => props.disabled,
  readOnly: () => props.readOnly,
  parse: parseIsoMonth,
  toPublicValue: formatIsoMonth,
  onUpdateModelValue: (value) => emit("update:modelValue", value),
  onUpdateOpen: (open) => emit("update:open", open),
});

const minDate = computed(() => parseIsoMonth(props.min ?? ""));
// zag 月格值继承 focusedValue 的 day（normalizeValue: focusedValue.set({month})，可能是
// 今天/已选值的 day）→ max 锚当月 1 日会误禁当月，须换算当月末日
// （CalendarDate.set 内部 constrain，day=31 自动收敛到月末）
const maxDate = computed<DateValue | undefined>(() => {
  const anchor = parseIsoMonth(props.max ?? "");
  return anchor ? anchor.set({ day: 31 }) : undefined;
});
</script>

<template>
  <PickerShell
    v-bind="$attrs"
    :model-value="rootValue"
    :open="isOpen"
    :locale="props.locale"
    min-view="month"
    max-view="month"
    :min="minDate"
    :max="maxDate"
    :close-on-select="props.closeOnSelect"
    :read-only="props.readOnly"
    :disabled="props.disabled"
    :invalid="props.invalid"
    :placeholder="props.placeholder"
    :positioning="props.positioning"
    :class="props.class"
    :format="formatIsoMonth"
    :parse="parseIsoMonth"
    @update:model-value="handleValueUpdate"
    @update:open="setOpen"
  >
    <TCalendar mode="month" />
  </PickerShell>
</template>
