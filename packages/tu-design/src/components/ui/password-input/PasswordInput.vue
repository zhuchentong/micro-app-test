<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref } from "vue";
import { cn } from "../../../lib/utils";

const props = defineProps({
  /** 受控值；undefined 走内部非受控 */
  modelValue: { type: String as PropType<string | undefined>, default: undefined },
  /** 明文显示；undefined 走内部非受控（默认隐藏） */
  // default: undefined 禁用 Boolean casting（Checkbox/Dialog 同款约定）
  visible: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  autoComplete: {
    type: String as PropType<"current-password" | "new-password">,
    default: "current-password",
  },
  placeholder: { type: String, default: undefined },
  disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  invalid: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:visible": [visible: boolean];
}>();

// attrs（id/aria-*）转发给内部 input，保证 TLabel/TFormControl 关联
defineOptions({ inheritAttrs: false });

// 纯原生实现：input type 切换即可，无需 zag/ark 原语
const internalValue = ref("");
const current = computed(() => props.modelValue ?? internalValue.value);

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  internalValue.value = value;
  emit("update:modelValue", value);
}

const internalVisible = ref(false);
const isVisible = computed(() => props.visible ?? internalVisible.value);

function toggleVisible() {
  const next = !isVisible.value;
  internalVisible.value = next;
  emit("update:visible", next);
}
</script>

<template>
  <div
    :class="
      cn(
        'border-input flex h-9 w-full items-center rounded-md border shadow-sm transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/20 focus-within:ring-[3px] data-invalid:border-destructive data-invalid:ring-destructive/20 data-invalid:ring-[3px]',
        props.class,
      )
    "
    :data-invalid="props.invalid ? '' : undefined"
  >
    <input
      v-bind="$attrs"
      :type="isVisible ? 'text' : 'password'"
      :value="current"
      :autocomplete="props.autoComplete"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :aria-invalid="props.invalid || undefined"
      :class="'bg-transparent h-full w-full min-w-0 flex-1 rounded-md px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50'"
      @input="onInput"
    />
    <button
      type="button"
      :aria-label="isVisible ? '隐藏密码' : '显示密码'"
      :aria-pressed="isVisible ? 'true' : 'false'"
      :disabled="props.disabled"
      :class="'hover:text-foreground mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50'"
      @click="toggleVisible"
    >
      <!-- 可见时显示 EyeOff（点击隐藏），默认显示 Eye（点击查看） -->
      <slot name="visibility-icon" :visible="isVisible">
        <svg
          v-if="isVisible"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </slot>
    </button>
  </div>
</template>
