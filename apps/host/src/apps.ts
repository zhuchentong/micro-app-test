import type { MicroApp } from "@repo/wujie-kit";

// 菜单项形状上移到 bus 契约(host 静态兜底与子应用上报共用同一类型)
export type { MenuEntry } from "@repo/wujie-kit";
import type { MenuEntry } from "@repo/wujie-kit";

/** host 注册表条目:子应用元信息 + 侧栏菜单 */
export interface HostApp extends MicroApp {
  menu: MenuEntry[];
}

/**
 * 子应用注册表(事件契约见 @repo/wujie-kit 的 appEvents)。
 * 注:domain 的端口与各子应用 vite.config.ts 的 server.port 字面量人工保持同步
 * (dev.mjs/stop.mjs 自动发现端口无需登记;此处为主应用跨域 fetch 的运行时配置)。
 */
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
