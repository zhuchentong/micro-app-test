import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

/**
 * 平路由:所有页面以 src/pages 约定扫描生成(index、about、products/index、products/[id])。
 * 子应用 = 纯内容片段,页面标题语义由 host tab 标题承担。
 * routes 由 vue-router/vite 按约定扫描,页面文件 HMR 时按官方方式热替换路由表。
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
