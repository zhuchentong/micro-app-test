import { watch } from "vue";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { bus } from "wujie";
import { applyTheme, toThemeMode } from "@repo/themes";
import App from "./App.vue";
import { initWujie } from "./wujie";
import { AUTH_STORAGE_KEY } from "./gateway";
import { useThemeStore, useUserStore } from "@repo/store";
import "./styles/index.css";

const pinia = createPinia();
// 共享依赖守卫:生产构建的框架代码来自 public/generated/shared-deps.js(生成脚本 scripts/build-shared.mjs)
if (import.meta.env.PROD && !window.__MICRO_SHARED__) {
  throw new Error(
    "[shared-deps] 缺少共享依赖 bundle,请先执行 node scripts/build-shared.mjs(仓库根)",
  );
}

/**
 * 读取并恢复持久化登录用户(localStorage)。
 * host 是登录态权威源:启动时在此恢复,登录/登出的写入在 App.vue 侧
 * (sub:auth-login 监听与 logout action,复用 gateway.ts 导出的同一常量)。
 * JSON 损坏 / 非对象 / id 或 name 非字符串或空串一律视为无登录态
 * @returns 无返回值(仅产生 user store 写入副作用)
 */
function loadAuthUser(): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const { id, name } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || id === "" || typeof name !== "string" || name === "") return;
    useUserStore(pinia).setUser({ id, name });
  } catch {
    return;
  }
}
// 启动恢复登录态(须在 initWujie 之前:子应用握手同步取的是当前 user)
loadAuthUser();
// 初始化 wujie(内部创建 host→子应用状态同步器),须在挂载前完成
initWujie(pinia, bus);

// 主题穿透:host 是唯一的 CSS 变量写入方。
// 挂载前先应用一次防闪烁;子应用 DOM 位于宿主 document,变量经继承即时生效,
// 切换主题与自定义 token 覆盖均无需子应用重新部署
const themeStore = useThemeStore(pinia);

// 自定义 token 覆盖持久化(host 权威源:恢复与写入都在 host 侧,子应用零改动)
const CUSTOM_STORAGE_KEY = "wujie-mvp:theme-custom:v1";
/**
 * 读取自定义 token 覆盖(localStorage);JSON 损坏 / 非对象 / 值非字符串一律剔除
 * @returns 合法的自定义 token 表(无有效数据时为空对象)
 */
function loadCustom(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}
themeStore.setCustom(loadCustom());

/**
 * 把当前主题模式 + 自定义 token 写入根元素 CSS 变量(host 是唯一写入方)
 * @returns 无返回值(仅产生 CSS 变量写入副作用)
 */
const applyCurrentTheme = (): void =>
  applyTheme(document.documentElement, toThemeMode(themeStore.theme), themeStore.custom);
applyCurrentTheme();
watch(
  () => [themeStore.theme, themeStore.custom] as const,
  () => {
    applyCurrentTheme();
    // setCustom 整体替换 custom 引用,此处与写变量同源持久化
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(themeStore.custom));
  },
);

createApp(App).use(pinia).mount("#app");
