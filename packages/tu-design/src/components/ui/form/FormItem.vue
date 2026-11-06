<script setup lang="ts">
import { computed, inject, provide, ref, useId } from "vue";
import { cn } from "../../../lib/utils";
import { FIELD_KEY, FORM_ITEM_KEY, type FormItemContext } from "./context";

const fieldCtx = inject(FIELD_KEY)!;

const name = fieldCtx.name;
// 实例级唯一 id 前缀：裸 name 会与同页其他表单的同名字段冲突（Vue 3.5 useId，SSR 稳定）
const controlId = `${useId()}-${name}`;
const descriptionId = `${controlId}-form-item-description`;
const messageId = `${controlId}-form-item-message`;
const hasDescription = ref(false);
const hasMessage = ref(false);
const isInvalid = computed(() => (fieldCtx.field.value?.state.meta.errors.length ?? 0) > 0);

provide(FORM_ITEM_KEY, {
  name,
  controlId,
  descriptionId,
  messageId,
  hasDescription,
  hasMessage,
  isInvalid,
} satisfies FormItemContext);
</script>

<template>
  <div :class="cn('group flex flex-col gap-1.5')" :data-invalid="isInvalid ? '' : undefined">
    <slot />
  </div>
</template>
