<script setup lang="ts">
defineOptions({ name: "WorkspaceLayout" });
import { computed, ref } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import { useThemeStore } from "@repo/store";
import { apps } from "../apps";
import type { MenuEntry } from "../apps";
import { useMenuStore } from "../stores/menu";
import { useTabsStore } from "../stores/tabs";
import { useLogsStore } from "../stores/logs";
import LayoutSwitchButton from "../components/LayoutSwitchButton.vue";

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

const themeStore = useThemeStore();
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
const logs = useLogsStore();
const broadcastText = ref("");

function openFromMenu(appKey: string, menu: MenuEntry): void {
  tabs.openTab(appKey, menu.path, menu.query, menu.label);
  logs.add("host", `打开 ${appKey} · ${menu.label}`);
}

function broadcast(): void {
  const text = broadcastText.value.trim();
  if (!text) return;
  // 多实例语义:不携带 target = 广播给所有保活 Tab
  bus.$emit(appEvents.broadcast, { text, from: "host" });
  logs.add("host", `广播: ${text}`);
  broadcastText.value = "";
}
</script>

<template>
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
          :class="{ active: tabs.activeTab?.app === app.key && tabs.activeTab?.page === menu.path }"
          @click="openFromMenu(app.key, menu)"
        >
          {{ menu.label }}
        </button>
      </section>
    </nav>

    <section class="broadcast">
      <h2>广播到所有 Tab</h2>
      <form @submit.prevent="broadcast">
        <input v-model="broadcastText" aria-label="广播内容" placeholder="输入消息…" type="text" />
        <button type="submit">发送</button>
      </form>
    </section>

    <section class="logs">
      <h2>bus 消息日志</h2>
      <p v-if="logs.entries.length === 0" class="empty">暂无消息</p>
      <ul v-else>
        <li v-for="log in logs.entries" :key="log.id">
          <span class="time">{{ log.time }}</span>
          <span class="source" :data-source="log.source">{{ log.source }}</span>
          <span class="text">{{ log.text }}</span>
        </li>
      </ul>
    </section>

    <LayoutSwitchButton class="focus-mode" label="专注模式" target="blank" />
  </aside>
</template>

<style scoped>
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
  color: var(--app-success);
}

.text {
  word-break: break-all;
}

.empty {
  font-size: 12px;
  color: var(--app-text-3);
  margin: 0;
}

.focus-mode {
  flex: none;
}
</style>
