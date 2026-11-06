<script setup lang="ts">
import type { PropType } from "vue";
import { computed } from "vue";
import { cn } from "../../../lib/utils";
import CloseIcon from "../icon-shared/CloseIcon.vue";
import type { Key } from "./interface";

const props = defineProps({
  /** 展示的选中值（key + label） */
  values: { type: Array as PropType<{ key: Key; label: string }[]>, required: true },
  /** 最多展示的 tag 数，超出折叠为 +N */
  maxTagCount: { type: Number, default: undefined },
  /** 展示尾部清空按钮（清空动作由宿主处理） */
  clearable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits<{
  remove: [key: Key];
  clear: [];
}>();

const shown = computed(() =>
  props.maxTagCount === undefined ? props.values : props.values.slice(0, props.maxTagCount),
);
const overflow = computed(() =>
  props.maxTagCount === undefined ? 0 : Math.max(0, props.values.length - props.maxTagCount),
);
</script>

<template>
  <span :class="cn('flex min-w-0 flex-1 flex-wrap items-center gap-1', $attrs.class)">
    <span
      v-for="v in shown"
      :key="v.key"
      data-part="tag"
      :data-key="v.key"
      class="inline-flex max-w-full items-center gap-0.5 rounded-sm bg-accent px-1.5 py-0.5 text-xs font-normal text-accent-foreground"
    >
      <span class="truncate">{{ v.label }}</span>
      <button
        v-if="!disabled"
        type="button"
        data-part="tag-remove"
        class="text-muted-foreground hover:text-foreground"
        :aria-label="`移除 ${v.label}`"
        @click.stop="emit('remove', v.key)"
      >
        <CloseIcon class="size-3" />
      </button>
    </span>
    <span v-if="overflow > 0" data-part="tag-overflow" class="text-xs text-muted-foreground"
      >+{{ overflow }}</span
    >
    <button
      v-if="clearable && !disabled"
      type="button"
      data-part="clear"
      class="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
      aria-label="清空"
      @click.stop="emit('clear')"
    >
      <CloseIcon class="size-4" />
    </button>
  </span>
</template>
