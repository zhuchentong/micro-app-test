<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ initial?: number }>();

const count = ref(props.initial ?? 0);
</script>

<template>
  <div class="counter">
    <span class="count">{{ count }}</span>
    <Button size="sm" type="button" variant="outline" @click="count += 1">+1</Button>
    <Button size="sm" type="button" variant="outline" @click="count = 0">重置</Button>
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
</style>
