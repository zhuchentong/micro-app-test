import { createApp } from "vue";
import { mountWujieApp } from "@repo/wujie-kit/sub";
import App from "../App.vue";
import router from "../router";
import { piniaSetup } from "./setups/pinia.setup";
import { themeSetup } from "./setups/theme.setup";

/**
 * 创建 Vue 应用实例并按序安装 setups(每次 MOUNT 新建,兼容保活/重建两种 wujie 模式)。
 * 新增启动关注点时:实现 setups/<name>.setup.ts 后在此按序追加一行。
 * @returns 未安装业务插件的 Vue 应用实例(router 由本函数收尾安装)
 */
function createVueApp() {
  const app = createApp(App);
  const pinia = piniaSetup(app);
  themeSetup(pinia);
  app.use(router);
  return app;
}

/**
 * 应用启动组合根:wujie 生命周期挂载与独立运行 fallback 统一交由 mountWujieApp,
 * 本文件只负责"创建什么应用"。
 */
export function bootstrap(): void {
  mountWujieApp(createVueApp);
}
