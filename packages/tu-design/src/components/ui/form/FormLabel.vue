<script setup lang="ts">
import { computed, inject } from "vue";
import { cn } from "../../../lib/utils";
import { FORM_ITEM_KEY } from "./context";

const itemCtx = inject(FORM_ITEM_KEY, undefined);
const props = defineProps<{ class?: string }>();

if (import.meta.env.DEV && !itemCtx) {
  console.warn("[tu-design] <FormLabel> 必须在 <FormField> + <FormItem> 内使用");
}

const isInvalid = computed(() => itemCtx?.isInvalid.value ?? false);
</script>

<template>
  <label
    :for="itemCtx?.controlId"
    :data-invalid="isInvalid ? '' : undefined"
    :class="cn('text-sm font-medium leading-none data-invalid:text-destructive', props.class)"
  >
    <slot />
  </label>
</template>
