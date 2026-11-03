import type { SubAppConfig } from "@repo/wujie-kit";

/** 应用标识、主题色与侧栏菜单(bus 事件契约统一由 @repo/wujie-kit 提供) */
export const appConfig = {
  name: "子应用 B",
  accent: "#52c41a",
  menu: [
    { label: "首页", path: "/" },
    { label: "通信演示", path: "/about" },
  ],
} satisfies SubAppConfig;
