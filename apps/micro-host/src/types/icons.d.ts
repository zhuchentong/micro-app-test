/* unplugin-icons 虚拟模块:~icons/<collection>/<name> 编译为内联 SVG 组件(按需,零运行时) */
declare module "~icons/*" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
