<script setup lang="ts">
defineOptions({ name: "WorkspaceLayout" });
import { ref } from "vue";
import IconDashboard from "~icons/tdesign/dashboard";
import IconUser from "~icons/tdesign/user";
import { apps } from "../apps";
import type { HostApp, MenuEntry } from "../apps";
import { useMenuStore } from "../stores/menu";
import { useTabsStore } from "../stores/tabs";
import { useLayoutStore } from "../stores/layout";
import { useLogsStore } from "../stores/logs";
import LayoutSwitchButton from "../components/LayoutSwitchButton.vue";

/** 58px 图标导航卡:每子应用一个图标项,hover 浮层列出该子应用全部菜单项 */
const tabs = useTabsStore();
const menuStore = useMenuStore();
const layoutStore = useLayoutStore();
const logs = useLogsStore();

/** 当前 hover 展开浮层的子应用 key(null = 全收起);与 CSS :hover 双通道保证浮层可编程触发 */
const hoveredApp = ref<string | null>(null);

/** 子应用 → 导航图标的静态映射(按需 import,禁动态字符串拼接) */
const navIcons: Record<string, unknown> = {
  "sub-a": IconDashboard,
  "sub-b": IconUser,
};

function navIcon(app: HostApp): unknown {
  return navIcons[app.key] ?? IconDashboard;
}

function openHome(app: HostApp): void {
  const home = app.menu[0];
  if (home) openFromMenu(app, home);
}

function openFromMenu(app: HostApp, menu: MenuEntry): void {
  hoveredApp.value = null;
  // 打开新 Tab 时应用子应用默认布局;去重命中已有 Tab 不改变布局(见 layout.applyAppDefault)
  void tabs
    .openTab(app.key, menu.path, menu.query, menu.label)
    .then((created) => layoutStore.applyAppDefault(app.defaultLayout, created));
  logs.add("host", `打开 ${app.key} · ${menu.label}`);
}
</script>

<template>
  <aside class="icon-nav">
    <div aria-hidden="true" class="nav-brand">
      <icon-svg-logo />
    </div>

    <nav class="nav-list">
      <!-- mouseenter/leave 挂在 nav-group:移入浮层期间不收起;nav-popover--open 为编程强制显示通道 -->
      <div v-for="app in apps" :key="app.key" class="nav-group">
        <button
          class="nav-item"
          :class="{ active: tabs.activeTab?.app === app.key }"
          type="button"
          :aria-label="`${app.name} 首页`"
          :title="app.name"
          @click="openHome(app)"
          @mouseenter="hoveredApp = app.key"
          @mouseleave="hoveredApp = null"
          @focus="hoveredApp = app.key"
          @blur="hoveredApp = null"
        >
          <component :is="navIcon(app)" />
        </button>
        <div class="nav-popover" :class="{ 'nav-popover--open': hoveredApp === app.key }">
          <button
            v-for="(menu, index) in menuStore.menuFor(app.key)"
            :key="app.key + menu.path"
            class="popover-item"
            :data-menu-index="index"
            type="button"
            @click="openFromMenu(app, menu)"
          >
            {{ menu.label }}
          </button>
        </div>
      </div>
    </nav>

    <LayoutSwitchButton class="focus-mode" label="专注模式" target="blank">
      <icon-tdesign-fullscreen />
    </LayoutSwitchButton>
  </aside>
</template>

<style scoped>
.icon-nav {
  width: 58px;
  flex: none;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 16px 11px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-raised);
}

.nav-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--app-brand);
}

.nav-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.nav-group {
  position: relative;
}

.nav-item {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-2);
  font-size: 20px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.nav-item:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-1);
}

.nav-item.active {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.nav-item:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}

/* 浮层:默认隐藏;:hover 与 nav-popover--open 双通道均可强制显示 */
.nav-popover {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  display: none;
  flex-direction: column;
  min-width: 120px;
  padding: 6px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: var(--app-bg-raised);
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  z-index: 10;
}

.nav-group:hover .nav-popover,
.nav-popover.nav-popover--open {
  display: flex;
}

.popover-item {
  padding: 7px 12px;
  border: none;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-text-1);
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.popover-item:hover {
  background: var(--app-accent-soft);
  color: var(--app-accent);
}

.popover-item:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: -2px;
}

/* 专注模式:图标式中性按钮,钉在导航卡底部 */
.focus-mode {
  flex: none;
  width: 38px;
  height: 38px;
  padding: 0;
  justify-content: center;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-2);
  font-size: 18px;
}
</style>
