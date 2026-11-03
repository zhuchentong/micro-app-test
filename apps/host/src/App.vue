<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import type {
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
  MenuReportPayload,
} from "@repo/wujie-kit";
import { useThemeStore } from "@repo/store";
import { formatClockTime } from "@repo/share";
import AppBadge from "./components/AppBadge.vue";
import { apps } from "./apps";
import type { MenuEntry } from "./apps";
import { useTabsStore } from "./stores/tabs";
import { useMenuStore } from "./stores/menu";

interface LogEntry {
  id: number;
  time: string;
  source: string;
  text: string;
}

// 主题状态(pinia 已在 main.ts 安装,setup 内直接使用);tabs store 依赖 wujie.ts 先 initWujie
const themeStore = useThemeStore();

/** 主题色预设:accent 及派生 soft/border/contrast 成组下发,保持组合观感一致 */
interface AccentPreset {
  label: string;
  tokens: Record<string, string>;
}
const accentPresets: AccentPreset[] = [
  {
    // 空 tokens = 回落内置青色(与「重置」等效,切换器内直达);默认态由 activeAccent undefined 感知高亮
    label: "青(默认)",
    tokens: {},
  },
  {
    // 以下为演示性备选:显式 override builtin,值不随 themes 升级变化
    label: "靛蓝",
    tokens: {
      "--app-accent": "#4f46e5",
      "--app-accent-soft": "#eef2ff",
      "--app-accent-soft-border": "#c7d2fe",
      "--app-accent-contrast": "#ffffff",
    },
  },
  {
    label: "蓝",
    tokens: {
      "--app-accent": "#2563eb",
      "--app-accent-soft": "#dbeafe",
      "--app-accent-soft-border": "#93c5fd",
      "--app-accent-contrast": "#ffffff",
    },
  },
  {
    label: "绿",
    tokens: {
      "--app-accent": "#059669",
      "--app-accent-soft": "#d1fae5",
      "--app-accent-soft-border": "#6ee7b7",
      "--app-accent-contrast": "#ffffff",
    },
  },
  {
    label: "紫",
    tokens: {
      "--app-accent": "#7c3aed",
      "--app-accent-soft": "#ede9fe",
      "--app-accent-soft-border": "#c4b5fd",
      "--app-accent-contrast": "#ffffff",
    },
  },
];
// unset(无自定义)为 undefined,与「青(默认)」空 tokens 精确匹配实现默认态高亮
const activeAccent = computed(() => themeStore.custom["--app-accent"]);
function applyAccent(preset: AccentPreset): void {
  // 空 tokens = 回落内置 preset(整体清空 custom,与 resetAccent 等效)
  if (Object.keys(preset.tokens).length === 0) {
    resetAccent();
    return;
  }
  themeStore.setCustom({ ...themeStore.custom, ...preset.tokens });
}
function resetAccent(): void {
  themeStore.setCustom({});
}
const tabs = useTabsStore();
const menuStore = useMenuStore();
const logs = ref<LogEntry[]>([]);
const broadcastText = ref("");
let logId = 0;

function addLog(source: string, text: string): void {
  logs.value.unshift({ id: ++logId, time: formatClockTime(new Date()), source, text });
  if (logs.value.length > 50) logs.value.pop();
}

function openFromMenu(appKey: string, menu: MenuEntry): void {
  tabs.openTab(appKey, menu.path, menu.query, menu.label);
  addLog("host", `打开 ${appKey} · ${menu.label}`);
}

async function closeTab(id: string): Promise<void> {
  const title = tabs.tabs.find((tab) => tab.id === id)?.title ?? id;
  await tabs.closeTab(id);
  addLog("host", `关闭 Tab · ${title}`);
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

function onMenuReport(payload?: MenuReportPayload): void {
  if (!payload) return;
  menuStore.applyReport(payload);
  addLog("host", `菜单上报 ${payload.app} · ${payload.menu.length} 项`);
}

function onNotify(data: { from: string; text: string }): void {
  addLog(data.from, data.text);
}

onMounted(async () => {
  bus.$on(appEvents.tabOpen, onTabOpen);
  bus.$on(appEvents.tabRoute, onTabRoute);
  bus.$on(appEvents.tabTitle, onTabTitle);
  bus.$on(appEvents.notify, onNotify);
  bus.$on(appEvents.menu, onMenuReport);

  // 启动顺序:子应用实例的 Tab 事件已在事件契约中,listener 先注册再恢复 Tab
  tabs.init(apps);
  addLog("host", "Tabs 已恢复");
});

onUnmounted(() => {
  bus.$off(appEvents.tabOpen, onTabOpen);
  bus.$off(appEvents.tabRoute, onTabRoute);
  bus.$off(appEvents.tabTitle, onTabTitle);
  bus.$off(appEvents.notify, onNotify);
  bus.$off(appEvents.menu, onMenuReport);
});
</script>

<template>
  <div class="layout">
    <aside class="sider">
      <h1 class="brand"><icon-svg-logo /> 无界 MVP · 主应用</h1>

      <button class="theme-toggle" type="button" @click="themeStore.toggleTheme()">
        <icon-tdesign-moon v-if="themeStore.theme === 'light'" />
        <icon-tdesign-sunny v-else />
        {{ themeStore.theme === "light" ? "暗色" : "亮色" }}
      </button>

      <section class="custom-theme">
        <h2>主题色</h2>
        <div class="accent-row">
          <button
            v-for="preset in accentPresets"
            :key="preset.label"
            :aria-label="`切换主题色:${preset.label}`"
            class="accent-dot"
            :class="{ active: activeAccent === preset.tokens['--app-accent'] }"
            :style="{ background: preset.tokens['--app-accent'] }"
            :title="preset.label"
            type="button"
            @click="applyAccent(preset)"
          />
          <button class="accent-reset" type="button" @click="resetAccent">重置</button>
        </div>
      </section>

      <nav class="app-list">
        <section v-for="app in apps" :key="app.key" class="app-group">
          <AppBadge :label="app.name" :color="app.color" />
          <button
            v-for="menu in menuStore.menuFor(app.key)"
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
      <div class="tabs-bar" role="tablist">
        <!-- Tab 用 div role=tab:内部需要嵌套真关闭按钮,button 嵌套 button 属无效 HTML(lint 强制) -->
        <div
          v-for="tab in tabs.tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === tabs.activeId, cold: tab.state === 'cold' }"
          role="tab"
          :aria-selected="tab.id === tabs.activeId"
          tabindex="0"
          @click="tabs.activate(tab.id)"
          @keydown.enter.prevent="tabs.activate(tab.id)"
          @keydown.space.prevent="tabs.activate(tab.id)"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <span v-if="tab.state === 'cold'" class="reload-hint" title="实例已释放,激活时重建"
          >↻</span>
          <button
            class="tab-close"
            type="button"
            :aria-label="`关闭 Tab · ${tab.title}`"
            @click.stop="closeTab(tab.id)"
            @keydown.stop
          >×</button>
        </div>
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
  /* 主题变量由 @repo/themes 经 host main.ts 写入 :root,此处只消费(var 经继承穿透到子应用 DOM) */
  background: var(--app-bg-page);
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
  border-right: 1px solid var(--app-border);
  overflow-y: auto;
  background: var(--app-bg-surface);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  margin: 0;
}

.theme-toggle {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-raised);
  color: var(--app-text-1);
  font-size: 13px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--app-bg-hover);
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
  color: var(--app-text-1);
  cursor: pointer;
}

.menu-item:hover {
  background: var(--app-bg-hover);
}

.menu-item.active {
  background: var(--app-accent-soft);
  border-color: var(--app-accent-soft-border);
  color: var(--app-accent);
  font-weight: 600;
}

.custom-theme {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-theme h2 {
  font-size: 13px;
  color: var(--app-text-3);
  margin: 0;
  font-weight: 500;
}

.accent-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.accent-dot {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
}

.accent-dot.active {
  border-color: var(--app-text-1);
}

.accent-reset {
  padding: 2px 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-2);
  font-size: 12px;
  cursor: pointer;
}

.accent-reset:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-1);
}

.broadcast {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.broadcast h2,
.logs h2 {
  font-size: 13px;
  color: var(--app-text-3);
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
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg-raised);
  color: var(--app-text-1);
  font-size: 13px;
}

.broadcast input::placeholder {
  color: var(--app-text-3);
}

.broadcast button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--app-accent);
  color: var(--app-accent-contrast);
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
  color: var(--app-text-3);
  flex: none;
}

.source {
  flex: none;
  font-weight: 600;
  color: var(--app-accent);
}

.source[data-source="host"] {
  color: #059669;
}

.text {
  word-break: break-all;
}

.empty {
  font-size: 12px;
  color: var(--app-text-3);
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
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-surface);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--app-border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: var(--app-bg-tab-inactive);
  color: var(--app-text-1);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.tab:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: -2px;
}

.tab:hover {
  background: var(--app-accent-soft);
}

.tab.active {
  background: var(--app-bg-raised);
  border-color: var(--app-accent-soft-border);
  color: var(--app-accent);
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
  color: var(--app-text-3);
}

.tab-close {
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-3);
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.tab-close:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}

.tab-close:hover {
  background: #fee2e2;
  color: #dc2626;
}

.tabs-placeholder {
  padding: 7px 4px;
  font-size: 13px;
  color: var(--app-text-3);
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
  color: var(--app-text-2);
  font-size: 15px;
}

.empty-state p,
.empty-hint {
  margin: 0;
}

.empty-hint {
  font-size: 13px;
}
</style>
