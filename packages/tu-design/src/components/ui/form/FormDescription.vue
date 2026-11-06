<script setup lang="ts">
import { inject, onMounted, onUnmounted } from "vue";
import { cn } from "../../../lib/utils";
import { FORM_ITEM_KEY } from "./context";

const itemCtx = inject(FORM_ITEM_KEY, undefined);
const props = defineProps<{ class?: string }>();

if (import.meta.env.DEV && !itemCtx) {
  console.warn("[tu-design] <FormDescription> 必须在 <FormField> + <FormItem> 内使用");
}

onMounted(() => itemCtx && (itemCtx.hasDescription.value = true));
onUnmounted(() => itemCtx && (itemCtx.hasDescription.value = false));
</script>

<template>
  <p :id="itemCtx?.descriptionId" :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </p>
</template>
