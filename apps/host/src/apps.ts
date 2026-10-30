import type { MicroApp } from "@repo/wujie-kit";

/** 主应用菜单项(静态注册;子应用上报菜单为后续增强) */
export interface MenuEntry {
  label: string;
  path: string;
  query?: Record<string, string>;
}

/** host 注册表条目:子应用元信息 + 侧栏菜单 */
export interface HostApp extends MicroApp {
  menu: MenuEntry[];
}

/** 子应用注册表(事件契约见 @repo/wujie-kit 的 appEvents) */
export const apps: HostApp[] = [
  {
    key: "sub-a",
    name: "子应用 A",
    domain: "http://localhost:7201",
    color: "#5b8ff9",
    menu: [
      { label: "首页", path: "/" },
      { label: "产品", path: "/products" },
    ],
  },
  {
    key: "sub-b",
    name: "子应用 B",
    domain: "http://localhost:7202",
    color: "#52c41a",
    menu: [
      { label: "首页", path: "/" },
      { label: "通信演示", path: "/about" },
    ],
  },
];
