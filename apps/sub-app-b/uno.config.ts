import { createUnoConfig } from "@repo/config/unocss/index.ts";

// preflight 关闭:reset 由各自 style.css / host 统一负责,避免 wujie 注入时重复覆盖
export default createUnoConfig({
  content: {
    pipeline: {
      // share 包在 app root 之外,须显式纳入扫描,公共组件里的工具类才不会漏
      include: [/\.(vue|ts)(\?|$)/, /\.(art\.vue)(\?|$)/, /packages[\\/]share[\\/]/],
    },
  },
});
