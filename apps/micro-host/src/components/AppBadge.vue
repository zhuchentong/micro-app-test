<script setup lang="ts">
defineProps<{ label: string; color: string; active?: boolean }>();
</script>

<template>
  <span class="badge" :class="{ active }">
    <i class="dot" :style="{ background: color }" />
    {{ label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--app-text-2);
}

.badge.active {
  color: var(--app-text-1);
  font-weight: 600;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
</style>
