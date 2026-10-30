import { createApp } from "vue";
import { createPinia } from "pinia";
import { mountWujieApp } from "@repo/wujie-kit/sub";
import { createSubStoreSync } from "@repo/store/sub";
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

  app.use(router);
  return app;
});
