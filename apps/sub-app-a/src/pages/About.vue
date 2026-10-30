<script setup lang="ts">
import { onMounted, ref } from "vue";
import { appConfig } from "../app.config";
import { subBus } from "../bus";

const { registerBroadcastListener, notifyHost: notify } = subBus;

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
    <section class="card">
      <h2>发送通知到主应用(sub:notify)</h2>
      <form class="row" @submit.prevent="send">
        <input v-model="draft" aria-label="通知内容" placeholder="输入要发送的内容…" type="text" />
        <button type="submit">发送</button>
      </form>
      <p class="hint">已发送 {{ sentCount }} 条,可在主应用日志面板查看。</p>
    </section>

    <section class="card">
      <h2>接收主应用广播(host:broadcast)</h2>
      <p v-if="subBus.lastBroadcast" class="received">收到: {{ subBus.lastBroadcast }}</p>
      <p v-else class="hint">暂无广播,在主应用侧栏发送一条试试。</p>
    </section>

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

.card {
  border: 1px solid var(--sub-border);
  border-radius: 10px;
  padding: 16px;
  background: var(--sub-surface);
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.card h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

.row {
  display: flex;
  gap: 8px;
}

.row input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--sub-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--sub-surface);
  color: var(--sub-text);
}

.row button {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: v-bind("appConfig.accent");
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.hint {
  font-size: 13px;
  color: var(--sub-muted);
  margin: 8px 0 0;
}

.received {
  margin: 0;
  font-size: 14px;
}

.meta {
  font-size: 12px;
  color: var(--sub-faint);
}
</style>
