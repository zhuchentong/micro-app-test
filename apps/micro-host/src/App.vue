<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { bus } from "wujie";
import { appEvents } from "@repo/wujie-kit";
import type {
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
  MenuReportPayload,
  AuthLoginPayload,
} from "@repo/wujie-kit";
import Workbench from "./Workbench.vue";
import TabsBar from "./components/TabsBar.vue";
import { apps } from "./apps";
import { AUTH_STORAGE_KEY, startAuthGateway, destroyAuthGateway } from "./gateway";
import { useTabsStore } from "./stores/tabs";
import { useMenuStore } from "./stores/menu";
import { useLayoutStore } from "./stores/layout";
import { useLogsStore } from "./stores/logs";
import { layouts } from "./layouts";
import { useUserStore } from "@repo/store";

// 主题状态(pinia 已在 main.ts 安装,setup 内直接使用);tabs store 依赖 wujie.ts 先 initWujie
const tabs = useTabsStore();
const menuStore = useMenuStore();
const logs = useLogsStore();
const layoutStore = useLayoutStore();
const userStore = useUserStore();

/** 登录分流:user store 为权威源,未登录时整个业务 shell 不挂载,仅渲染网关容器 */
const isAuthed = computed(() => userStore.isLoggedIn);

/** 网关挂载容器(未登录视图全屏 div;v-else 渲染时才存在,故 nextTick 后取引用) */
const gatewayEl = ref<HTMLElement | null>(null);

/** 当前布局条目:current 已在 store 的 loadLayout 白名单校验,必命中注册表 */
const activeLayout = computed(() => layouts[layoutStore.current]);

async function onTabOpen(payload?: TabOpenPayload): Promise<void> {
  if (!payload) return;
  const created = await tabs.openFromPayload(payload);
  // 打开新 Tab 时应用子应用默认布局(去重命中已有 Tab 不改变布局)
  const app = apps.find((item) => item.key === payload.app);
  if (app) layoutStore.applyAppDefault(app.defaultLayout, created);
  logs.add("host", `tab-open ${payload.app} · ${payload.page}`);
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
  logs.add("host", `菜单上报 ${payload.app} · ${payload.menu.length} 项`);
}

function onNotify(data: { from: string; text: string }): void {
  logs.add(data.from, data.text);
}

/**
 * sub:auth-login 处理:payload 校验(user 对象存在且 id/name 非空字符串)通过才采信。
 * host 是登录态权威源:localStorage 写入仅发生在此处与 logout,启动恢复在 main.ts
 * @param payload 网关上报的登录用户(wujie bus 可能投递 undefined,统一按可选防御)
 */
function onAuthLogin(payload?: AuthLoginPayload): void {
  const user = payload?.user;
  if (
    !user ||
    typeof user.id !== "string" ||
    user.id === "" ||
    typeof user.name !== "string" ||
    user.name === ""
  ) {
    console.warn("[auth] 忽略非法的登录事件 payload:", payload);
    return;
  }
  userStore.setUser(user);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  logs.add("auth", `登录成功 · ${user.name}`);
}

/**
 * 登出:清登录态 + 移除持久化 + 结束 Tab 会话。
 * isAuthed watch 随后自动切回未登录视图并重新拉起网关(alive:false 重建模式)。
 * endSession 必须执行:shell 卸载会移除 tab 容器 DOM,保活实例不销毁会悬挂白屏;
 * tabsReady 一并复位,再登录时重新走 init(快照已清,干净开场)。
 */
function logout(): void {
  userStore.clearUser();
  localStorage.removeItem(AUTH_STORAGE_KEY);
  logs.add("auth", "已退出登录");
  tabsReady = false;
  void tabs.endSession();
}

/** Tab 系统是否已初始化:登录前不拉起业务子应用,首次登录后仅初始化一次 */
let tabsReady = false;

// 登录分流副作用:Tab 系统初始化(仅首次登录后一次)+ 网关容器生命周期(随登录态起停)
watch(
  isAuthed,
  (authed) => {
    if (authed && !tabsReady) {
      tabsReady = true;
      // 启动顺序:子应用实例的 Tab 事件已在事件契约中,listener 先注册再恢复 Tab
      tabs.init(apps);
      // 布局恢复优先级:手动选择(localStorage 持久化)优先;无记录时兜底为激活 Tab 子应用的默认布局
      if (!layoutStore.hasStoredLayout && tabs.activeTab) {
        const restoredApp = apps.find((item) => item.key === tabs.activeTab?.app);
        if (restoredApp) layoutStore.setLayout(restoredApp.defaultLayout);
      }
      logs.add("host", "Tabs 已恢复");
    }
    if (authed) {
      // 已登录:销毁网关实例(未登录视图正在卸载,容器随之移除)
      void destroyAuthGateway();
    } else {
      // 未登录:等 v-else 容器渲染后再拉起网关(immediate 首帧即未登录时同样生效)
      void nextTick(() => {
        if (gatewayEl.value) startAuthGateway(gatewayEl.value);
      });
    }
  },
  { immediate: true },
);

onMounted(() => {
  bus.$on(appEvents.tabOpen, onTabOpen);
  bus.$on(appEvents.tabRoute, onTabRoute);
  bus.$on(appEvents.tabTitle, onTabTitle);
  bus.$on(appEvents.notify, onNotify);
  bus.$on(appEvents.menu, onMenuReport);
  bus.$on(appEvents.authLogin, onAuthLogin);
});

onUnmounted(() => {
  bus.$off(appEvents.tabOpen, onTabOpen);
  bus.$off(appEvents.tabRoute, onTabRoute);
  bus.$off(appEvents.tabTitle, onTabTitle);
  bus.$off(appEvents.notify, onNotify);
  bus.$off(appEvents.menu, onMenuReport);
  bus.$off(appEvents.authLogin, onAuthLogin);
});
</script>

<template>
  <!-- 登录分流:登录后渲染业务 shell;未登录整个 shell 不挂载,仅渲染全屏网关容器 -->
  <!-- shell--{name} 是未来布局级 shell 几何(grid 等)的扩展点;当前布局差异全在 chrome 层 -->
  <div v-if="isAuthed" class="shell" :class="`shell--${layoutStore.current}`">
    <!-- 常驻 chrome:tabs-bar 显隐随布局声明,wujie 容器层(Workbench.pane-area)永不随布局切换卸载/移动 -->
    <TabsBar v-show="activeLayout.meta.showTabsBar" />
    <div class="shell-main">
      <!-- 登出意图由布局层上抛(workspace icon-nav 底部用户 avatar);核心清理仍集中在此处 -->
      <component :is="activeLayout.component" @logout="logout" />
      <Workbench />
    </div>
  </div>
  <!-- 未登录:授权网关全屏容器(不进 Tab 系统;wujie startApp 的挂载点,由 isAuthed watch 拉起) -->
  <div v-else ref="gatewayEl" class="gateway-fullscreen" />
</template>

<style scoped>
.shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* 主题变量由 @repo/themes 经 host main.ts 写入 :root,此处只消费(var 经继承穿透到子应用 DOM);
     壳层用 page-deep(设计稿 node 91:1 画布色,比衬底/卡片深一档),卡片层次由各自底色承担 */
  background: var(--app-bg-page-deep);
}

.shell-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 12px 16px;
}

/* blank 专注模式:无 chrome,pane 全出血 */
.shell--blank .shell-main {
  padding: 0;
  gap: 0;
}

/* 未登录网关容器:占满视口剩余空间(shell 未挂载时为根级唯一子元素) */
.gateway-fullscreen {
  flex: 1;
  min-height: 0;
  background: var(--app-bg-page);
}
</style>
