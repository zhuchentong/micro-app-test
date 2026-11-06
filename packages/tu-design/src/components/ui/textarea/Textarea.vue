<script setup lang="ts">
import { cn } from "../../../lib/utils";

const modelValue = defineModel<string | number>();
const props = defineProps<{ class?: string; invalid?: boolean }>();
</script>

<template>
  <textarea
    v-model="modelValue"
    :aria-invalid="props.invalid ? 'true' : undefined"
    :class="
      cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive md:text-sm',
        props.class,
      )
    "
  />
</template>
