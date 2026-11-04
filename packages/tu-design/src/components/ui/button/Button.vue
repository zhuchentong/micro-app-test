<script setup lang="ts">
import { cn } from "../../../lib/utils";
import { Slot } from "../../../components/ui/slot";
import { buttonVariants, type ButtonVariants } from "./index";

interface Props {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
  as?: string;
  asChild?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), { as: "button" });
</script>

<template>
  <Slot
    v-if="props.asChild"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </Slot>
  <component
    v-else
    :is="props.as"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot name="icon" />
    <slot />
  </component>
</template>
