<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref } from "vue";
import { Switch as ArkSwitch } from "@ark-ui/vue/switch";
import { cn } from "../../../lib/utils";

// checked 用 default: undefined 禁用 Boolean casting（Dialog 同款约定）
const props = defineProps({
  checked: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  defaultChecked: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  class: { type: String, default: undefined },
});

const emit = defineEmits<{ "update:checked": [checked: boolean] }>();

// 对 Root 恒走受控模式，非受控语义由内部 ref 实现（Dialog 同款）
const internalChecked = ref(props.defaultChecked);
const isChecked = computed(() => props.checked ?? internalChecked.value);

function handleUpdate(checked: boolean) {
  internalChecked.value = checked;
  emit("update:checked", checked);
}
</script>

<template>
  <ArkSwitch.Root
    :checked="isChecked"
    :disabled="props.disabled"
    :class="cn('inline-flex items-center gap-2', props.class)"
    @update:checked="handleUpdate"
  >
    <ArkSwitch.HiddenInput />
    <ArkSwitch.Control
      class="peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <ArkSwitch.Thumb
        class="bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </ArkSwitch.Control>
    <ArkSwitch.Label v-if="$slots.default" class="text-sm font-medium select-none">
      <slot />
    </ArkSwitch.Label>
  </ArkSwitch.Root>
</template>
