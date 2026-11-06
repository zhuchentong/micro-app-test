<script setup lang="ts">
import { cn } from "../../../lib/utils";
import { computed } from "vue";

interface Props {
  orientation?: "horizontal" | "vertical";
  class?: string;
}

const props = withDefaults(defineProps<Props>(), { orientation: "horizontal" });

const orientationClass = computed(() =>
  props.orientation === "vertical" ? "w-px h-full" : "h-px w-full",
);
</script>

<template>
  <div
    :data-orientation="props.orientation"
    :class="cn('bg-border shrink-0', orientationClass, props.class)"
  />
</template>
