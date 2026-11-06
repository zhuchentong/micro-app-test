<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref } from "vue";
import { NumberInput as ArkNumberInput } from "@ark-ui/vue/number-input";
import { cn } from "../../../lib/utils";
import { numberOrNull } from "./utils";

const props = defineProps({
  /** 受控值：number 或 null（空）；undefined 走内部非受控 */
  modelValue: { type: Number as PropType<number | null | undefined>, default: undefined },
  min: { type: Number, default: undefined },
  max: { type: Number, default: undefined },
  step: { type: Number, default: undefined },
  formatOptions: { type: Object as PropType<Intl.NumberFormatOptions>, default: undefined },
  // default: undefined 禁用 Boolean casting（Checkbox/Dialog 同款约定）
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{ "update:modelValue": [value: number | null] }>();

// attrs（id/aria-*）转发给内部真实 input，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

// 对 Ark Root 恒走受控模式，非受控语义由内部 ref 实现（Checkbox 同款）
const internalValue = ref<number | null>(null);
const current = computed(() =>
  props.modelValue === undefined ? internalValue.value : props.modelValue,
);

/** number → Ark 受控 string（null/NaN → 空串） */
const arkValue = computed(() =>
  current.value == null || Number.isNaN(current.value) ? "" : String(current.value),
);

/**
 * Ark details（value: string / valueAsNumber: number）→ number|null（空串/NaN 归一 null）
 * @param details - Ark NumberInput 的 ValueChangeDetails
 */
function handleValueChange(details: { value: string; valueAsNumber: number }) {
  const next = numberOrNull(details);
  internalValue.value = next;
  emit("update:modelValue", next);
}
</script>

<template>
  <ArkNumberInput.Root
    :model-value="arkValue"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :format-options="props.formatOptions"
    :disabled="props.disabled"
    :invalid="props.invalid"
    :class="
      cn(
        'border-input flex h-9 items-stretch overflow-hidden rounded-md border shadow-sm transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] data-invalid:border-destructive data-invalid:ring-destructive/20 data-invalid:ring-[3px]',
        props.class,
      )
    "
    @value-change="handleValueChange"
  >
    <ArkNumberInput.DecrementTrigger
      :class="'bg-muted/50 hover:bg-accent flex w-9 shrink-0 items-center justify-center border-r text-muted-foreground text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'"
    >
      <slot name="decrement">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
        </svg>
      </slot>
    </ArkNumberInput.DecrementTrigger>
    <ArkNumberInput.Input
      v-bind="$attrs"
      :class="'bg-transparent flex-1 min-w-0 px-1 text-center text-sm outline-none disabled:cursor-not-allowed'"
    />
    <ArkNumberInput.IncrementTrigger
      :class="'bg-muted/50 hover:bg-accent flex w-9 shrink-0 items-center justify-center border-l text-muted-foreground text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'"
    >
      <slot name="increment">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </slot>
    </ArkNumberInput.IncrementTrigger>
  </ArkNumberInput.Root>
</template>
