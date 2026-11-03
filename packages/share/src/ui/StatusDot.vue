<script setup lang="ts">
const props = withDefaults(
  defineProps<{ status?: "ok" | "warn" | "error" | "idle"; label?: string }>(),
  { status: "idle", label: "" },
);

const colors: Record<string, string> = {
  ok: "#22c55e",
  warn: "#f59e0b",
  error: "#ef4444",
  idle: "#9ca3af",
};
</script>

<template>
  <span class="status-dot">
    <i class="dot" :style="{ background: colors[props.status] }" />
    <span class="label">{{ label }}</span>
  </span>
</template>

<style scoped>
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
</style>
