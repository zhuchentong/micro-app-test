<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import type { TabOpenPayload, TabRoutePayload, TabTitlePayload } from "@repo/wujie-kit";
import { useThemeStore } from "@repo/store";
import AppBadge from "./components/AppBadge.vue";
import { apps } from "./apps";
import type { MenuEntry } from "./apps";
import { useTabsStore } from "./stores/tabs";

interface LogEntry {
  id: number;
  time: string;
  source: string;
  text: string;
}

// 主题状态(pinia 已在 main.ts 安装,setup 内直接使用);tabs store 依赖 wujie.ts 先 initWujie
const themeStore = useThemeStore();
const tabs = useTabsStore();
const logs = ref<LogEntry[]>([]);
const broadcastText = ref("");
let logId = 0;

function addLog(source: string, text: string): void {
  logs.value.unshift({ id: ++logId, time: new Date().toLocaleTimeString(), source, text });
  if (logs.value.length > 50) logs.value.pop();
}

function openFromMenu(appKey: string, menu: MenuEntry): void {
  tabs.openTab(appKey, menu.path, menu.query, menu.label);
  addLog("host", `打开 ${appKey} · ${menu.label}`);
}

async function closeTab(id: string): Promise<void> {
  await tabs.closeTab(id);
  addLog("host", "关闭 Tab");
}

function broadcast(): void {
  const text = broadcastText.value.trim();
  if (!text) return;
  // 多实例语义:不携带 target = 广播给所有保活 Tab
  bus.$emit(appEvents.broadcast, { text, from: "host" });
  addLog("host", `广播: ${text}`);
  broadcastText.value = "";
}

function onTabOpen(payload?: TabOpenPayload): void {
  if (!payload) return;
  tabs.openFromPayload(payload);
  addLog("host", `tab-open ${payload.app} · ${payload.page}`);
}

function onTabRoute(payload?: TabRoutePayload): void {
  if (payload) tabs.applyTabRoute(payload);
}

function onTabTitle(payload?: TabTitlePayload): void {
  if (payload) tabs.applyTabTitle(payload);
}

function onNotify(data: { from: string; text: string }): void {
  addLog(data.from, data.text);
}

onMounted(async () => {
  bus.$on(appEvents.tabOpen, onTabOpen);
  bus.$on(appEvents.tabRoute, onTabRoute);
  bus.$on(appEvents.tabTitle, onTabTitle);
  bus.$on(appEvents.notify, onNotify);

  // 启动顺序:子应用实例的 Tab 事件已在事件契约中,listener 先注册再恢复 Tab
  tabs.init(apps);
  addLog("host", "Tabs 已恢复");
});

onUnmounted(() => {
  bus.$off(appEvents.tabOpen, onTabOpen);
  bus.$off(appEvents.tabRoute, onTabRoute);
  bus.$off(appEvents.tabTitle, onTabTitle);
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
        <section v-for="app in apps" :key="app.key" class="app-group">
          <AppBadge :label="app.name" :color="app.color" />
          <button
            v-for="menu in app.menu"
            :key="app.key + menu.path"
            class="menu-item"
            type="button"
            :class="
              { active: tabs.activeTab?.app === app.key && tabs.activeTab?.page === menu.path }
            "
            @click="openFromMenu(app.key, menu)"
          >
            {{ menu.label }}
          </button>
        </section>
      </nav>

      <section class="broadcast">
        <h2>广播到所有 Tab</h2>
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

    <main class="workbench">
      <div class="tabs-bar">
        <button
          v-for="tab in tabs.tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === tabs.activeId, cold: tab.state === 'cold' }"
          type="button"
          @click="tabs.activate(tab.id)"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <span v-if="tab.state === 'cold'" class="reload-hint" title="实例已释放,激活时重建"
          >↻</span>
          <span aria-hidden="true" class="tab-close" @click.stop="closeTab(tab.id)">×</span>
        </button>
        <span v-if="tabs.tabs.length === 0" class="tabs-placeholder"
        >点击左侧菜单打开子应用页面</span>
      </div>

      <div class="pane-area">
        <!-- 每 Tab 一个常驻容器,保活实例不卸载,切换只切显隐 -->
        <div
          v-for="tab in tabs.tabs"
          v-show="tab.id === tabs.activeId"
          :id="`tab-container-${tab.n}`"
          :key="tab.id"
          class="tab-pane"
        />
        <div v-if="!tabs.activeTab" class="empty-state">
          <p>未打开任何页面</p>
          <p class="empty-hint">从左侧菜单进入,或在子应用产品列表中点击产品即可在 Tabs 中打开</p>
        </div>
      </div>
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
  gap: 12px;
}

.app-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px 8px 24px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.menu-item:hover {
  background: #f3f4f6;
}

.menu-item.active {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4f46e5;
  font-weight: 600;
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
  gap: 6px;
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
  margin: 0;
}

/* 工作台:TabsBar + 每 Tab 容器 */
.workbench {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tabs-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 0;
  overflow-x: auto;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: #f9fafb;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.tab:hover {
  background: #eef2ff;
}

.tab.active {
  background: #fff;
  border-color: #c7d2fe;
  color: #4f46e5;
  font-weight: 600;
}

.tab.cold {
  opacity: 0.7;
  border-style: dashed;
}

.tab-title {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reload-hint {
  font-size: 12px;
  color: #9ca3af;
}

.tab-close {
  padding: 0 2px;
  border-radius: 4px;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
}

.tab-close:hover {
  background: #fee2e2;
  color: #dc2626;
}

.tabs-placeholder {
  padding: 7px 4px;
  font-size: 13px;
  color: #9ca3af;
}

.pane-area {
  flex: 1;
  min-height: 0;
  position: relative;
}

.tab-pane {
  height: 100%;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #6b7280;
  font-size: 15px;
}

.empty-state p,
.empty-hint {
  margin: 0;
}

.empty-hint {
  font-size: 13px;
}

/* 暗色主题:变量式覆盖 sider 与 TabsBar 配色,保持既有视觉语言 */
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

.layout[data-theme="dark"] .menu-item {
  color: #d1d5db;
}

.layout[data-theme="dark"] .menu-item:hover {
  background: #1f2937;
}

.layout[data-theme="dark"] .menu-item.active {
  background: #312e81;
  border-color: #4338ca;
  color: #c7d2fe;
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

.layout[data-theme="dark"] .tabs-bar {
  background: #111827;
  border-bottom-color: #1f2937;
}

.layout[data-theme="dark"] .tab {
  background: #0b1220;
  border-color: #1f2937;
  color: #d1d5db;
}

.layout[data-theme="dark"] .tab:hover {
  background: #1f2937;
}

.layout[data-theme="dark"] .tab.active {
  background: #111827;
  border-color: #4338ca;
  color: #c7d2fe;
}

.layout[data-theme="dark"] .empty-state {
  color: #6b7280;
}
</style>
