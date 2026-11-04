import type { SubAppConfig } from "@repo/wujie-kit";

/** 应用标识、主题色与侧栏菜单(bus 事件契约统一由 @repo/wujie-kit 提供) */
export const appConfig = {
  name: "测试 Demo",
  accent: "#722ed1",
  menu: [
    { label: "布局演示", path: "/" },
    { label: "表格页", path: "/table" },
    { label: "表单页", path: "/form" },
  ],
} satisfies SubAppConfig;
