/**
 * PageContainer:页面布局骨架统一入口。
 *
 * - PageContainer:分发壳,layout="default/table/form" 选择布局(推荐入口);
 * - DefaultLayout / TableLayout / FormLayout:具名布局,精确控制时直接使用
 *   (DefaultLayout 可作路由级组件,其余为页面级 slot 模板)。
 *
 * 约束:布局组件保持无状态(不依赖任何 Pinia store),纯 props + slots,
 * wujie 保活场景下安全;样式仅消费 --app-* 语义 token(禁字面色值、禁 tailwind
 * utility class —— packages/* 源码不在消费方 Tailwind 扫描范围)。
 * tu-design 组件如需使用必须显式 import(如 `@repo/tu-design/button`)。
 */
export { default as PageContainer } from "./PageContainer.vue";
export { default as DefaultLayout } from "./layouts/DefaultLayout.vue";
export { default as TableLayout } from "./layouts/TableLayout.vue";
export { default as FormLayout } from "./layouts/FormLayout.vue";
