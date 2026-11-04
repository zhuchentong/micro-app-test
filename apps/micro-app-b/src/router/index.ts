import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

/**
 * 平路由:页面以自身根元素作为页面根。
 * routes 由 vue-router/vite 按约定扫描 src/pages 生成(index/about),
 * path 与迁移前手写路由一致(/、/about),路由 name 经 definePage 保留。
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
