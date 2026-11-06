<script setup lang="ts">
import { provide } from "vue";
import { cn } from "../../../lib/utils";
import { FORM_KEY, type FormInstance } from "./context";

const props = defineProps<{
  /** useForm() 返回的实例 */
  form: FormInstance;
  class?: string;
}>();

provide(FORM_KEY, props.form);
</script>

<template>
  <form
    novalidate
    :class="cn('flex flex-col gap-4', props.class)"
    @submit.prevent="props.form.handleSubmit()"
  >
    <slot />
  </form>
</template>
