import { createApp } from "vue";
import { createPinia } from "pinia";
import { mountWujieApp } from "@repo/wujie-kit/sub";
import { createSubStoreSync } from "@repo/store/sub";
import { useThemeStore } from "@repo/store";
import { applyTheme, toThemeMode } from "@repo/themes";
import App from "./App.vue";
import router from "./router";
import "./style.css";

mountWujieApp(() => {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // store 同步组合根:每次挂载创建新实例,兼容保活(只注册一次)与非保活(remount 重建)
  const storeSync = createSubStoreSync({ pinia });
  storeSync.register();
  app.onUnmount(() => storeSync.dispose());

  // 主题:嵌入模式由 host 写 :root 经继承穿透,子应用不参与;
  // 独立运行(无 $wujie)时自行应用 preset 兜底,保证 fallback 观感一致
  if (typeof window !== "undefined" && !window.$wujie) {
    applyTheme(document.documentElement, toThemeMode(useThemeStore(pinia).theme));
  }

  app.use(router);
  return app;
});
