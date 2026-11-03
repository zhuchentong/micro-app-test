import { watch } from "vue";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { bus } from "wujie";
import { applyTheme, toThemeMode } from "@repo/themes";
import App from "./App.vue";
import { initWujie } from "./wujie";
import { useThemeStore, useUserStore } from "@repo/store";
import "./styles/index.css";

const pinia = createPinia();
// 共享依赖守卫:生产构建的框架代码来自 public/generated/shared-deps.js(生成脚本 scripts/build-shared.mjs)
if (import.meta.env.PROD && !window.__MICRO_SHARED__) {
  throw new Error(
    "[shared-deps] 缺少共享依赖 bundle,请先执行 node scripts/build-shared.mjs(仓库根)",
  );
}
// 演示用户:host 为状态权威源,初始数据从这里下发(经 props 与握手快照同步给子应用)
useUserStore(pinia).setUser({ id: "u1", name: "宿主张三" });
// 初始化 wujie(内部创建 host→子应用状态同步器),须在挂载前完成
initWujie(pinia, bus);

// 主题穿透:host 是唯一的 CSS 变量写入方。
// 挂载前先应用一次防闪烁;子应用 DOM 位于宿主 document,变量经继承即时生效,
// 切换主题与自定义 token 覆盖均无需子应用重新部署
const themeStore = useThemeStore(pinia);

// 自定义 token 覆盖持久化(host 权威源:恢复与写入都在 host 侧,子应用零改动)
const CUSTOM_STORAGE_KEY = "wujie-mvp:theme-custom:v1";
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
