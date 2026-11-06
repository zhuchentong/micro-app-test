<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref } from "vue";
import { Checkbox as ArkCheckbox } from "@ark-ui/vue/checkbox";
import { cn } from "../../../lib/utils";

// checked 用 default: undefined 禁用 Boolean casting（Dialog 同款约定）；
// "indeterminate" 对齐 Ark UI CheckedState，用于表格全选等半选语义（S10）
const props = defineProps({
  checked: {
    type: [Boolean, String] as PropType<boolean | "indeterminate" | undefined>,
    default: undefined,
  },
  defaultChecked: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** 原生表单提交的字段名（透传 HiddenInput，与 RadioGroup 对齐） */
  name: { type: String, default: undefined },
  /** 关联的 form id */
  form: { type: String, default: undefined },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{ "update:checked": [checked: boolean] }>();

// 对 Root 恒走受控模式，非受控语义由内部 ref 实现（Dialog 同款）
const internalChecked = ref<boolean>(props.defaultChecked);
const isChecked = computed(() => props.checked ?? internalChecked.value);

function handleUpdate(checked: boolean | "indeterminate") {
  const next = checked === "indeterminate" ? false : checked;
  internalChecked.value = next;
  emit("update:checked", next);
}
</script>

<template>
  <ArkCheckbox.Root
    :checked="isChecked"
    :disabled="props.disabled"
    :name="props.name"
    :form="props.form"
    :class="cn('inline-flex items-center gap-2', props.class)"
    @update:checked="handleUpdate"
  >
    <ArkCheckbox.HiddenInput />
    <ArkCheckbox.Control
      class="border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 peer size-4 shrink-0 rounded-[4px] border bg-transparent shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ArkCheckbox.Indicator class="flex items-center justify-center text-current">
        <!-- 半选态（data-state=indeterminate）显示短横线，选中态显示对勾 -->
        <svg
          v-if="isChecked === 'indeterminate'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          class="size-3.5"
        >
          <path d="M5 12h14" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-3.5"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </ArkCheckbox.Indicator>
    </ArkCheckbox.Control>
    <ArkCheckbox.Label v-if="$slots.default" class="text-sm leading-none font-medium select-none">
      <slot />
    </ArkCheckbox.Label>
  </ArkCheckbox.Root>
</template>
