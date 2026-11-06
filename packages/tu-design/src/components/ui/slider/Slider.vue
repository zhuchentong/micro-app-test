<script setup lang="ts">
import type { PropType } from "vue";
import { computed } from "vue";
import { Slider as ArkSlider } from "@ark-ui/vue/slider";
import { cn } from "../../../lib/utils";

interface Props {
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  class?: string;
}

const props = withDefaults(
  defineProps<{
    /** 当前值（配合 v-model）；单值或区间数组，不传时为非受控。出参恒为 number[] */
    modelValue?: number | number[];
    /** 同 modelValue（兼容别名，v-model 场景请直接用 modelValue） */
    value?: number | number[];
    defaultValue?: number | number[];
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    class?: string;
  }>(),
  { min: 0, max: 100, step: 1 },
);

const emit = defineEmits<{ "update:modelValue": [value: number[]] }>();

const toArray = (v: number | number[] | undefined) =>
  v === undefined ? undefined : Array.isArray(v) ? v : [v];

// modelValue 未传时回落 value（兼容别名）；都未传走非受控（defaultValue/内部状态）
const thumbs = computed(
  () =>
    toArray(props.modelValue) ?? toArray(props.value) ?? toArray(props.defaultValue) ?? [props.min],
);
</script>

<template>
  <ArkSlider.Root
    :model-value="toArray(props.modelValue) ?? toArray(props.value)"
    :default-value="toArray(props.defaultValue)"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    :class="
      cn(
        'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50',
        props.class,
      )
    "
    @update:model-value="(value: number[]) => emit('update:modelValue', value)"
  >
    <ArkSlider.Control class="relative flex h-5 w-full items-center">
      <ArkSlider.Track class="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
        <ArkSlider.Range class="bg-primary absolute h-full" />
      </ArkSlider.Track>
      <ArkSlider.Thumb
        v-for="(_, index) in thumbs"
        :key="index"
        :index="index"
        class="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
      >
        <ArkSlider.HiddenInput />
      </ArkSlider.Thumb>
    </ArkSlider.Control>
  </ArkSlider.Root>
</template>
