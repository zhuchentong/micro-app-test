import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { useHostProps } from "@repo/wujie-kit/sub";

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

// wujie 同 app 多实例竞态兜底:沙箱 location 代理在实例快速连续启动时可能滞后
// (前一实例刚写 "/"),本实例 router 的初始导航会读到错误路径,渲染成别的页面后
// 永不纠正(replaceState 不触发 popstate)。用 host 注入的 tab.page 显式对齐初始
// 路由;独立运行(无 $wujie/tab)时无此问题,跳过。
const intendedTab = useHostProps()?.tab;
if (intendedTab) {
  void router.replace({ path: intendedTab.page });
}

export default router;

// 页面文件 HMR 时按官方方式热替换路由表
if (import.meta.hot) {
  import("vue-router/auto-routes").then(({ handleHotUpdate }) => handleHotUpdate(router));
}
