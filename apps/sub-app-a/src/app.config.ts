import type { SubAppConfig } from "@repo/wujie-kit";

/** 应用标识、主题色与侧栏菜单(bus 事件契约统一由 @repo/wujie-kit 提供) */
export const appConfig = {
  name: "子应用 A",
  accent: "#5b8ff9",
  // 菜单上报覆盖 host 静态兜底(静态缺"关于",上报后侧栏出现第三项以演示覆盖链路)
  menu: [
    { label: "首页", path: "/" },
    { label: "产品", path: "/products" },
    { label: "关于", path: "/about" },
  ],
} satisfies SubAppConfig;
