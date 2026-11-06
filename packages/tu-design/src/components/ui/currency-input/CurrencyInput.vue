<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref, watch } from "vue";
import { cn } from "../../../lib/utils";
import { formatCurrency, parseCurrency, type CurrencyUnit } from "./utils";

const props = defineProps({
  /** 受控值（valueUnit 单位）；undefined 走内部非受控，null 表示空 */
  modelValue: { type: Number as PropType<number | null | undefined>, default: undefined },
  /** 界面输入单位 */
  labelUnit: { type: String as PropType<CurrencyUnit>, default: "元" },
  /** 存储单位（v-model 值的单位） */
  valueUnit: { type: String as PropType<CurrencyUnit>, default: "元" },
  placeholder: { type: String, default: undefined },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{
  "update:modelValue": [value: number | null];
}>();

// attrs（id/aria-*）转发给内部 input，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

// 纯原生实现：金额换算为十进制字符串移位（整数分精度），无需 ark/zag 原语
const internalValue = ref<number | null>(null);
const isControlled = computed(() => props.modelValue !== undefined);

// 输入框保留用户键入原文；仅外部 modelValue 变化（非本次 emit 回流）才反算回显
const display = ref(
  props.modelValue !== undefined && props.modelValue !== null
    ? formatCurrency(props.modelValue, props.valueUnit, props.labelUnit)
    : "",
);
let lastEmitted: number | null | undefined;

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value;
  display.value = raw;
  const next = parseCurrency(raw, props.labelUnit, props.valueUnit);
  lastEmitted = next;
  if (!isControlled.value) internalValue.value = next;
  emit("update:modelValue", next);
}

watch(
  () => props.modelValue,
  (value) => {
    if (!isControlled.value || value === lastEmitted) return;
    display.value = value === null ? "" : formatCurrency(value, props.valueUnit, props.labelUnit);
  },
);
</script>

<template>
  <div
    :class="
      cn(
        'border-input flex h-9 w-full items-center overflow-hidden rounded-md border shadow-sm transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-[3px] data-invalid:border-destructive data-invalid:ring-destructive/20 data-invalid:ring-[3px]',
        props.class,
      )
    "
    :data-invalid="props.invalid ? '' : undefined"
  >
    <input
      v-bind="$attrs"
      type="text"
      inputmode="decimal"
      :value="display"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :aria-invalid="props.invalid || undefined"
      :class="'bg-transparent h-full w-full min-w-0 flex-1 px-3 text-sm tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-50'"
      @input="onInput"
    />
    <div
      aria-hidden="true"
      :class="
        cn(
          'border-input text-muted-foreground flex h-full shrink-0 items-center border-l bg-muted/40 px-3 text-sm',
          props.disabled && 'opacity-50',
        )
      "
    >
      {{ props.labelUnit }}
    </div>
  </div>
</template>
