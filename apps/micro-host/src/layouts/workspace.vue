<script setup lang="ts">
defineOptions({ name: "WorkspaceLayout" });
import { computed, onMounted, onUnmounted, ref } from "vue";
import IconDashboard from "~icons/tdesign/dashboard";
import { apps } from "../apps";
import type { HostApp, MenuEntry, MenuGroup } from "../apps";
import { useMenuStore } from "../stores/menu";
import { useTabsStore } from "../stores/tabs";
import { useLayoutStore } from "../stores/layout";
import { useLogsStore } from "../stores/logs";
import { useUserStore } from "@repo/store";
import LayoutSwitchButton from "../components/LayoutSwitchButton.vue";

/** 58px 图标导航卡:每子应用一个图标项,点击弹出全高子菜单面板(对照设计稿 327:524/327:319) */
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

/** 面板展开中的子应用 key(null = 全收起);点击图标切换,打开页面统一走面板菜单项 */
const activePanelApp = ref<string | null>(null);

/** 子应用 → 导航图标的静态映射(按需 import,禁动态字符串拼接) */
const navIcons: Record<string, unknown> = {
  "micro-app-demo": IconDashboard,
};

function navIcon(app: HostApp): unknown {
  return navIcons[app.key] ?? IconDashboard;
}

/** 分组标题图标静态映射(按需 import,禁动态字符串拼接;未命中回退该子应用导航图标) */
const groupIcons: Record<string, unknown> = {
  dashboard: IconDashboard,
};

function groupIcon(name: string | undefined, app: HostApp): unknown {
  return (name && groupIcons[name]) || navIcon(app);
}

/** 面板展开中的子应用对象(null = 未展开) */
const panelApp = computed(() => apps.find((a) => a.key === activePanelApp.value) ?? null);

/** 展开面板的分组菜单数据(契约:menuFor 返回 MenuGroup[];未展开时为空) */
const panelMenu = computed<MenuGroup[]>(() =>
  panelApp.value ? menuStore.menuFor(panelApp.value.key) : [],
);

/** 点击图标切换面板:同 key 再点收起、不同 key 切换;不再直接打开首页
 * @param app 目标子应用
 */
function togglePanel(app: HostApp): void {
  activePanelApp.value = activePanelApp.value === app.key ? null : app.key;
}

/** 图标项附加类:路由激活 + 面板展开归属。Button 的 class prop 声明为 string,
 *  数组绑定会触发 TS2322,故拼接为空格分隔字符串返回
 * @param app 目标子应用
 * @returns 空格分隔的附加类名;无附加类时返回 undefined(不渲染 class 绑定值)
 */
function navItemClass(app: HostApp): string | undefined {
  const flags = [
    tabs.activeTab?.app === app.key ? "active" : "",
    activePanelApp.value === app.key ? "panel-open" : "",
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" ") : undefined;
}

/** 跨分组扁平序号:前面分组 children 长度求和(e2e 依赖 data-menu-index 全局连续)
 * @param groups 分组菜单
 * @param index 当前分组下标
 * @returns 当前分组首个菜单项的全局扁平序号
 */
function groupOffset(groups: MenuGroup[], index: number): number {
  return groups.slice(0, index).reduce((sum, group) => sum + group.children.length, 0);
}

/** 面板菜单项激活态:当前激活 Tab 命中该子应用且同一路径(Tab 记录字段名为 page)
 * @param app 目标子应用
 * @param menu 目标菜单项
 * @returns 当前激活 Tab 是否命中该菜单项
 */
function isActiveLink(app: HostApp, menu: MenuEntry): boolean {
  return tabs.activeTab?.app === app.key && tabs.activeTab?.page === menu.path;
}

function openFromMenu(app: HostApp, menu: MenuEntry): void {
  // 打开新 Tab 时应用子应用默认布局;去重命中已有 Tab 不改变布局(见 layout.applyAppDefault)
  void tabs
    .openTab(app.key, menu.path, menu.query, menu.label)
    .then((created) => layoutStore.applyAppDefault(app.defaultLayout, created));
  logs.add("host", `打开 ${app.key} · ${menu.label}`);
  // 打开页面后面板收起;面板与图标都挂在 .icon-nav 内,点击自身不会被全局关闭监听误收
  closePanel();
}

/** 收起面板:遮罩点击与全局关闭监听共用的唯一出口,避免多处散落置 null */
function closePanel(): void {
  activePanelApp.value = null;
}

/**
 * 全局关闭监听(无遮罩,设计稿全页黑色遮罩不实现),三条关闭路径:
 *   ① document click(capture):目标不在 .icon-nav 内 → 收起(面板与图标都在卡内,天然豁免)
 *   ② Esc → 收起
 *   ③ window blur 且焦点落入 IFRAME:点击 wujie 子应用 iframe 时 click 不冒泡到
 *      宿主 document,借 blur 兜底收起;仅 IFRAME 取焦才收,点浏览器 chrome 等误触不收
 * 处理器均先判 activePanelApp 非空,避免无谓触发
 * @param event document click 事件
 */
function onDocClick(event: MouseEvent): void {
  if (!activePanelApp.value) return;
  const nav = document.querySelector(".icon-nav");
  // 遮罩 teleport 到 body,不在 .icon-nav 内,此处先行收起;其自身 @click 再触发一次幂等
  if (nav && event.target instanceof Node && nav.contains(event.target)) return;
  closePanel();
}

function onDocKeydown(event: KeyboardEvent): void {
  if (activePanelApp.value && event.key === "Escape") closePanel();
}

function onWinBlur(): void {
  // 遮罩会拦截内容区点击,此路径基本冗余;保留兜底键盘焦点直落 iframe 的场景
  if (activePanelApp.value && document.activeElement?.tagName === "IFRAME") {
    closePanel();
  }
}

onMounted(() => {
  // click 用 capture 阶段:目标在 .icon-nav 内的判定不依赖事件能否冒泡回来
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onDocKeydown);
  window.addEventListener("blur", onWinBlur);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick, true);
  document.removeEventListener("keydown", onDocKeydown);
  window.removeEventListener("blur", onWinBlur);
});
</script>

<template>
  <aside class="icon-nav">
    <nav class="nav-list">
      <!-- 点击图标切换子菜单面板;panel-open 标记面板归属,打开页面统一走面板菜单项 -->
      <div v-for="app in apps" :key="app.key" class="nav-group">
        <Button
          class="nav-item"
          size="icon"
          variant="ghost"
          :class="navItemClass(app)"
          type="button"
          :aria-expanded="activePanelApp === app.key"
          :aria-label="app.name"
          :title="app.name"
          @click="togglePanel(app)"
        >
          <component :is="navIcon(app)" />
        </Button>
      </div>
    </nav>

    <!-- 遮罩:teleport 到 body,盖标签栏+内容区+子应用 sticky 表头(--z-sticky-head=30);
         侧边卡整体 z 51 高于遮罩,不被盖住(设计稿 327:319 侧栏亮)。点遮罩收起面板:
         capture 全局监听对 body 层的遮罩不再豁免,与自身 @click 双路径幂等收起 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="panelApp" aria-hidden="true" class="nav-mask" @click="closePanel" />
      </Transition>
    </Teleport>

    <!-- 子菜单面板:点击图标弹出,锚定导航卡全高、覆盖内容区;关闭路径见全局关闭监听与遮罩 -->
    <Transition name="fade">
      <div v-if="panelApp" class="nav-panel">
        <section v-for="(group, groupIndex) in panelMenu" :key="group.label" class="panel-group">
          <div class="panel-group-title">
            <component :is="groupIcon(group.icon, panelApp)" />
            <span class="panel-group-name">{{ group.label }}</span>
          </div>
          <div class="panel-links">
            <Button
              v-for="(menu, i) in group.children"
              :key="group.label + menu.path"
              :class="isActiveLink(panelApp, menu) ? 'panel-link active' : 'panel-link'"
              type="button"
              variant="ghost"
              :data-menu-index="groupOffset(panelMenu, groupIndex) + i"
              @click="openFromMenu(panelApp, menu)"
            >
              {{ menu.label }}
            </Button>
          </div>
        </section>
      </div>
    </Transition>

    <LayoutSwitchButton class="focus-mode" label="专注模式" target="blank">
      <icon-tdesign-fullscreen />
    </LayoutSwitchButton>

    <!-- 用户 avatar:钉在导航卡最底部,点击弹出用户菜单(用户名 + 退出登录);朝右侧弹出对齐触发器底沿;
         z 52 高于侧边卡(51):面板开着弹出时完整浮于面板与遮罩之上(两层浮窗叠加属预期行为) -->
    <Popover
      v-model:open="userMenuOpen"
      :positioning="{ placement: 'right-end' }"
      :z-index="52"
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
  /* 面板绝对定位锚点:nav-panel 由此锚定右侧 21px、全高展开;
     z 51(overlay+1)创建层叠上下文:整卡(背景/边框/图标/面板)高于 teleport 遮罩(50),
     侧栏整体不被遮罩盖住(设计稿 327:319 侧栏亮);内容侧最高层为 sticky 表头(--z-sticky-head=30) */
  position: relative;
  z-index: 51;
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

.nav-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* 导航图标项:tu-design Button(ghost/icon)打底,scoped 覆盖回 38px 导航规格(图标 16px,设计稿 node 109:200) */
.nav-item {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--app-radius-md);
  color: var(--app-text-2);
  font-size: 16px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

/* Button 基础样式会把无尺寸 class 的 svg 缩到 16px,恢复图标原尺寸 */
.nav-item :deep(svg) {
  width: 16px;
  height: 16px;
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

/* 面板展开中的图标:底色示归属(active 是路由激活的强调底,两者可叠加,后者不抢 active) */
.nav-item.panel-open:not(.active) {
  background: var(--app-bg-hover);
  color: var(--app-text-1);
}

.nav-item:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}

/* 全页遮罩:teleport 到 body + fixed 相对视口(.shell 系无 transform,fixed 不被劫持);
   z 走 --z-overlay(50):盖住内容侧全部层序(--z-sticky-head 30 表格 sticky 表头、
   --z-sticky 10 固定列、标签栏),侧边卡(51)与用户菜单(52)悬浮其上 */
.nav-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--app-overlay);
}

/* 遮罩/面板淡入淡出:150ms 与仓库既有 transition 风格一致 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 子菜单面板:锚定导航卡右侧 21px、与侧栏同高全高、覆盖内容区(设计稿 327:524);关闭走遮罩与全局监听 */
.nav-panel {
  position: absolute;
  left: calc(100% + 18px);
  top: 0;
  bottom: 0;
  width: 241px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px 19px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-xl);
  background: var(--app-bg-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  z-index: 20;
  overflow-y: auto;
}

.panel-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 分组标题条:强调色软底 + 强调色文字,内含 16px 分组图标 */
.panel-group-title {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 13px;
  font-weight: 500;
}

.panel-group-title svg {
  width: 16px;
  height: 16px;
}

.panel-group-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 链接区:设计稿链接行高 34、每行两列 */
.panel-links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

/* 面板菜单项:tu-design Button(ghost)打底,scoped 覆盖为左对齐满宽菜单条 */
.panel-link {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 8px;
  border-radius: var(--app-radius-sm);
  color: var(--app-text-2);
  font-size: 13px;
  font-weight: normal;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.panel-link:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-1);
}

/* 当前路由项:设计稿当前路由 SemiBold + 强调色 */
.panel-link.active {
  color: var(--app-accent);
  font-weight: 600;
}

.panel-link:focus-visible {
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
