<script setup lang="ts">
import { inject } from "vue";
import { FORM_KEY } from "./context";

const form = inject(FORM_KEY, undefined);

if (import.meta.env.DEV && !form) {
  console.warn("[tu-design] <FormSubscribe> 必须在 <Form> 内使用");
}
</script>

<template>
  <component v-if="form" :is="form.Subscribe">
    <template #default="state">
      <slot :can-submit="state.canSubmit" :is-submitting="state.isSubmitting" />
    </template>
  </component>
</template>
