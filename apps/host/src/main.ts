import { watch } from "vue";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { bus } from "wujie";
import { applyTheme, toThemeMode } from "@repo/themes";
import App from "./App.vue";
import { initWujie } from "./wujie";
import { useThemeStore, useUserStore } from "@repo/store";
import "./style.css";

const pinia = createPinia();
// 演示用户:host 为状态权威源,初始数据从这里下发(经 props 与握手快照同步给子应用)
useUserStore(pinia).setUser({ id: "u1", name: "宿主张三" });
// 初始化 wujie(内部创建 host→子应用状态同步器),须在挂载前完成
initWujie(pinia, bus);

// 主题穿透:host 是唯一的 CSS 变量写入方。
// 挂载前先应用一次防闪烁;子应用 DOM 位于宿主 document,变量经继承即时生效,
// 切换主题(含未来接入 localStorage/API 的自定义值)无需子应用重新部署
const themeStore = useThemeStore(pinia);
applyTheme(document.documentElement, toThemeMode(themeStore.theme));
watch(
  () => themeStore.theme,
  (mode) => applyTheme(document.documentElement, toThemeMode(mode)),
);

createApp(App).use(pinia).mount("#app");
