<script setup lang="ts">
defineOptions({ name: "WorkspaceLayout" });
import { computed, ref } from "vue";
import IconDashboard from "~icons/tdesign/dashboard";
import { apps } from "../apps";
import type { HostApp, MenuEntry } from "../apps";
import { useMenuStore } from "../stores/menu";
import { useTabsStore } from "../stores/tabs";
import { useLayoutStore } from "../stores/layout";
import { useLogsStore } from "../stores/logs";
import { useUserStore } from "@repo/store";
import LayoutSwitchButton from "../components/LayoutSwitchButton.vue";

/** 58px 图标导航卡:每子应用一个图标项,hover 浮层列出该子应用全部菜单项 */
const tabs = useTabsStore();
const menuStore = useMenuStore();
const layoutStore = useLayoutStore();
const logs = useLogsStore();
const userStore = useUserStore();

/** 登出:仅上报意图,持久化清理与 Tab 会话结束由 App.vue 处理 */
const emit = defineEmits<{ logout: [] }>();

/** 用户菜单浮层开关(受控:登出时程序化收起) */
const userMenuOpen = ref(false);

/** 文字头像:取用户名首字符(store 无头像 URL;未登录时 shell 不挂载,仅防御性兜底) */
const avatarChar = computed(() => userStore.user.name.charAt(0) || "?");

function logout(): void {
  userMenuOpen.value = false;
  emit("logout");
}

/** 当前 hover 展开浮层的子应用 key(null = 全收起);与 CSS :hover 双通道保证浮层可编程触发 */
const hoveredApp = ref<string | null>(null);

/** 子应用 → 导航图标的静态映射(按需 import,禁动态字符串拼接) */
const navIcons: Record<string, unknown> = {
  "micro-app-demo": IconDashboard,
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
        <Button
          class="nav-item"
          size="icon"
          variant="ghost"
          :class="tabs.activeTab?.app === app.key ? 'active' : undefined"
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
        </Button>
        <div class="nav-popover" :class="{ 'nav-popover--open': hoveredApp === app.key }">
          <Button
            v-for="(menu, index) in menuStore.menuFor(app.key)"
            :key="app.key + menu.path"
            class="popover-item"
            variant="ghost"
            :data-menu-index="index"
            type="button"
            @click="openFromMenu(app, menu)"
          >
            {{ menu.label }}
          </Button>
        </div>
      </div>
    </nav>

    <LayoutSwitchButton class="focus-mode" label="专注模式" target="blank">
      <icon-tdesign-fullscreen />
    </LayoutSwitchButton>

    <!-- 用户 avatar:钉在导航卡最底部,点击弹出用户菜单(用户名 + 退出登录);朝右侧弹出对齐触发器底沿 -->
    <Popover
      v-model:open="userMenuOpen"
      :positioning="{ placement: 'right-end' }"
      content-class="w-40 p-2"
    >
      <Button
        class="nav-avatar"
        size="icon"
        type="button"
        variant="ghost"
        :aria-label="`用户 ${userStore.user.name}`"
        :title="userStore.user.name"
      >
        {{ avatarChar }}
      </Button>
      <template #content>
        <div class="user-menu">
          <span class="user-menu-name">{{ userStore.user.name }}</span>
          <Button class="user-menu-logout" type="button" variant="ghost" @click="logout">
            退出登录
          </Button>
        </div>
      </template>
    </Popover>
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

/* 导航图标项:tu-design Button(ghost/icon)打底,scoped 覆盖回 38px 导航规格 */
.nav-item {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--app-radius-md);
  color: var(--app-text-2);
  font-size: 20px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

/* Button 基础样式会把无尺寸 class 的 svg 缩到 16px,恢复图标原尺寸 */
.nav-item :deep(svg) {
  width: 20px;
  height: 20px;
}

.nav-item:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-1);
}

.nav-item.active {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.nav-item.active:hover {
  background: var(--app-accent);
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

/* 浮层菜单项:tu-design Button(ghost)打底,scoped 覆盖为左对齐满宽菜单条 */
.popover-item {
  width: 100%;
  height: auto;
  display: flex;
  justify-content: flex-start;
  padding: 7px 12px;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-1);
  font-size: 13px;
  font-weight: normal;
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

/* 用户 avatar:文字头像(用户名首字符),38px 圆形与 nav-item 同规格,钉在导航卡最底部 */
.nav-avatar {
  flex: none;
  width: 38px;
  height: 38px;
  padding: 0;
  justify-content: center;
  border-radius: 50%;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 15px;
  font-weight: 600;
}

.nav-avatar:hover {
  background: var(--app-accent);
  color: var(--app-accent-contrast);
}

.nav-avatar:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}

/* 用户菜单面板(Popover content 插槽,teleport 后 scoped 仍生效):用户名 + 退出登录 */
.user-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-menu-name {
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 退出登录:满宽菜单条,hover 亮 destructive 语义 */
.user-menu-logout {
  width: 100%;
  height: auto;
  display: flex;
  justify-content: flex-start;
  padding: 7px 8px;
  border-radius: var(--app-radius-sm);
  color: var(--app-destructive);
  font-size: 13px;
  font-weight: normal;
  white-space: nowrap;
  cursor: pointer;
}

.user-menu-logout:hover {
  background: var(--app-destructive-soft);
  color: var(--app-destructive);
}

.user-menu-logout:focus-visible {
  outline: 2px solid var(--app-destructive);
  outline-offset: -2px;
}
</style>
