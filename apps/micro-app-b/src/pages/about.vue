<script setup lang="ts">
import { onMounted, ref } from "vue";
import { appConfig } from "../app.config";
import { subBus } from "../bus";

const { registerBroadcastListener, notifyHost: notify } = subBus;

// 保留路由 name(App.vue 的 RouterLink 按 name 跳转);definePage 为编译宏,无需 import
definePage({ name: "about" });

const draft = ref("");
const sentCount = ref(0);

function send(): void {
  const text = draft.value.trim();
  if (!text) return;
  notify(text);
  sentCount.value += 1;
  draft.value = "";
}

onMounted(() => {
  registerBroadcastListener();
});
</script>

<template>
  <main class="page">
    <Card title="发送通知到主应用(sub:notify)">
      <form class="row" @submit.prevent="send">
        <Input
          v-model="draft"
          aria-label="通知内容"
          class="min-w-0 flex-1"
          placeholder="输入要发送的内容…"
          type="text"
        />
        <Button type="submit">发送</Button>
      </form>
      <p class="hint">已发送 {{ sentCount }} 条,可在主应用日志面板查看。</p>
    </Card>

    <Card title="接收主应用广播(host:broadcast)">
      <p v-if="subBus.lastBroadcast" class="received">收到: {{ subBus.lastBroadcast }}</p>
      <p v-else class="hint">暂无广播,在主应用侧栏发送一条试试。</p>
    </Card>

    <p class="meta">{{ appConfig.name }} · {{ $route.fullPath }}</p>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-width: 560px;
}

.row {
  display: flex;
  gap: 8px;
}

.hint {
  font-size: 13px;
  color: var(--app-text-2);
  margin: 8px 0 0;
}

.received {
  margin: 0;
  font-size: 14px;
}

.meta {
  font-size: 12px;
  color: var(--app-text-3);
}
</style>
