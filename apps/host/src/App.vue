<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import { useThemeStore } from "@repo/store";
import AppBadge from "./components/AppBadge.vue";
import { apps } from "./apps";
import { parseLocation, startMicroApp } from "./wujie";

interface LogEntry {
  id: number;
  time: string;
  source: string;
  text: string;
}

// 主题状态(pinia 已在 main.ts 安装,setup 内直接使用)
const themeStore = useThemeStore();
const activeKey = ref("");
const logs = ref<LogEntry[]>([]);
const broadcastText = ref("");
let logId = 0;

function addLog(source: string, text: string): void {
  logs.value.unshift({ id: ++logId, time: new Date().toLocaleTimeString(), source, text });
  if (logs.value.length > 50) logs.value.pop();
}

function switchApp(key: string): void {
  if (key === activeKey.value) return;
  activeKey.value = key;
  const app = apps.find((item) => item.key === key);
  // 保活模式下切回的子应用不会重新挂载,也就不会重发 title 事件,host 兜底设置标题
  document.title = `无界 MVP · ${app?.name ?? key}`;
  startMicroApp(key);
  addLog("host", `切换到 ${app?.name ?? key}`);
}

function broadcast(): void {
  const text = broadcastText.value.trim();
  if (!text) return;
  bus.$emit(appEvents.broadcast, { text, from: "host" });
  addLog("host", `广播: ${text}`);
  broadcastText.value = "";
}

function onTitle(title: string): void {
  document.title = `无界 MVP · ${title}`;
}

function onNotify(data: { from: string; text: string }): void {
  addLog(data.from, data.text);
}

onMounted(() => {
  bus.$on(appEvents.title, onTitle);
  bus.$on(appEvents.notify, onNotify);

  const { app, path } = parseLocation();
  activeKey.value = app ?? apps[0]!.key;
  document.title = `无界 MVP · ${apps.find((item) => item.key === activeKey.value)?.name}`;
  startMicroApp(activeKey.value, path ?? "/");
  addLog("host", `已启动 ${apps.find((item) => item.key === activeKey.value)?.name}`);
});

onUnmounted(() => {
  bus.$off(appEvents.title, onTitle);
  bus.$off(appEvents.notify, onNotify);
});
</script>

<template>
  <div class="layout" :data-theme="themeStore.theme">
    <aside class="sider">
      <h1 class="brand">无界 MVP · 主应用</h1>

      <button class="theme-toggle" type="button" @click="themeStore.toggleTheme()">
        {{ themeStore.theme === "light" ? "🌙 暗色" : "☀️ 亮色" }}
      </button>

      <nav class="app-list">
        <button
          v-for="app in apps"
          :key="app.key"
          class="app-item"
          :class="{ active: app.key === activeKey }"
          type="button"
          @click="switchApp(app.key)"
        >
          <AppBadge :label="app.name" :color="app.color" :active="app.key === activeKey" />
        </button>
      </nav>

      <section class="broadcast">
        <h2>广播到当前子应用</h2>
        <form @submit.prevent="broadcast">
          <input
            v-model="broadcastText"
            aria-label="广播内容"
            placeholder="输入消息…"
            type="text"
          />
          <button type="submit">发送</button>
        </form>
      </section>

      <section class="logs">
        <h2>bus 消息日志</h2>
        <p v-if="logs.length === 0" class="empty">暂无消息</p>
        <ul v-else>
          <li v-for="log in logs" :key="log.id">
            <span class="time">{{ log.time }}</span>
            <span class="source" :data-source="log.source">{{ log.source }}</span>
            <span class="text">{{ log.text }}</span>
          </li>
        </ul>
      </section>
    </aside>

    <main class="container">
      <div id="app-container" />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sider {
  width: 280px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 16px;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  background: #fafafa;
}

.brand {
  font-size: 16px;
  margin: 0;
}

.theme-toggle {
  align-self: flex-start;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: #f3f4f6;
}

.app-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.app-item:hover {
  background: #f3f4f6;
}

.app-item.active {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.broadcast {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.broadcast h2,
.logs h2 {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
  font-weight: 500;
}

.broadcast form {
  display: flex;
  gap: 8px;
}

.broadcast input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.broadcast button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #4f46e5;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.logs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logs ul {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.logs li {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.time {
  color: #9ca3af;
  flex: none;
}

.source {
  flex: none;
  font-weight: 600;
  color: #4f46e5;
}

.source[data-source="host"] {
  color: #059669;
}

.text {
  word-break: break-all;
}

.empty {
  font-size: 12px;
  color: #9ca3af;
}

.container {
  flex: 1;
  min-width: 0;
}

#app-container {
  height: 100%;
}

/* 暗色主题:变量式覆盖 sider 相关配色,保持既有视觉语言 */
.layout[data-theme="dark"] .sider {
  background: #111827;
  border-right-color: #1f2937;
}

.layout[data-theme="dark"] .brand {
  color: #f9fafb;
}

.layout[data-theme="dark"] .theme-toggle {
  background: #1f2937;
  border-color: #374151;
  color: #e5e7eb;
}

.layout[data-theme="dark"] .theme-toggle:hover {
  background: #374151;
}

.layout[data-theme="dark"] .app-item:hover {
  background: #1f2937;
}

.layout[data-theme="dark"] .app-item.active {
  background: #312e81;
  border-color: #4338ca;
}

.layout[data-theme="dark"] .broadcast h2,
.layout[data-theme="dark"] .logs h2,
.layout[data-theme="dark"] .empty {
  color: #6b7280;
}

.layout[data-theme="dark"] .broadcast input {
  background: #1f2937;
  border-color: #374151;
  color: #e5e7eb;
}

.layout[data-theme="dark"] .time {
  color: #6b7280;
}
</style>
