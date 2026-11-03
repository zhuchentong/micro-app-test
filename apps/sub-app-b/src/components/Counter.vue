<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ initial?: number }>();

const count = ref(props.initial ?? 0);
</script>

<template>
  <div class="counter">
    <span class="count">{{ count }}</span>
    <button type="button" @click="count += 1">+1</button>
    <button type="button" @click="count = 0">重置</button>
  </div>
</template>

<style scoped>
.counter {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}

button {
  padding: 6px 14px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-surface);
  color: var(--app-text-1);
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

button:hover {
  background: var(--app-bg-hover);
}
</style>
