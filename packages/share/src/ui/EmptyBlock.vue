<script setup lang="ts">
withDefaults(defineProps<{ text?: string }>(), { text: "暂无数据" });
</script>

<template>
  <div class="empty-block">
    <span aria-hidden="true" class="mark">∅</span>
    <p class="text">{{ text }}</p>
  </div>
</template>

<style scoped>
.empty-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 24px;
  color: #9ca3af;
  font-size: 13px;
}

.mark {
  font-size: 18px;
}
</style>
