import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";

/**
 * 平路由:所有页面以 <PageContainer layout="..."> 作为页面根(不再有布局父级嵌套)。
 * 填充模式由 layout 类型固有决定:table/form 全高填充(height:100%,内部滚动),
 * default 随内容增高。子应用 = 纯内容片段,页面标题语义由 host tab 标题承担。
 * routes 由 vue-router/vite 按约定扫描 src/pages 生成(index/table/form)。
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
