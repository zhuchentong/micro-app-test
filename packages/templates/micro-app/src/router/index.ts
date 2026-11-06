import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

/**
 * 平路由:页面以自身根元素作为页面根。
 * routes 由 vue-router/vite 按约定扫描 src/pages 生成(index),
 * 导航统一走 path(App.vue 自 app.manifest.json 的 menu 渲染)。
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;

// 页面文件 HMR 时按官方方式热替换路由表
if (import.meta.hot) {
  import("vue-router/auto-routes").then(({ handleHotUpdate }) => handleHotUpdate(router));
}
