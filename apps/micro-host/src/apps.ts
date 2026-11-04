import type { MicroApp } from "@repo/wujie-kit";

// 菜单项形状上移到 bus 契约(host 静态兜底与子应用上报共用同一类型)
export type { MenuEntry } from "@repo/wujie-kit";
import type { MenuEntry } from "@repo/wujie-kit";

import type { LayoutName } from "./stores/layout";

/** host 注册表条目:子应用元信息 + 侧栏菜单 + 布局偏好 */
export interface HostApp extends MicroApp {
  menu: MenuEntry[];
  /** 该子应用的默认布局:打开新 Tab 时应用;已有 Tab 之间的激活不改变布局 */
  defaultLayout: LayoutName;
}

/**
 * 子应用 domain:跟随宿主被访问的地址(本机 localhost / 局域网 IP 直访均可用,
 * 支持把宿主入口 URL 分享给局域网协作者查看)。
 * 前提:子应用与宿主同机、不同端口;未来若改为同域 path 分发,需引入环境变量覆盖。
 * node 测试环境无 window(tabs.test.ts 以桩替换),回退 localhost 保持断言基线不变。
 * @param port 子应用 vite dev 端口(与各子应用 vite.config.ts 的 server.port 字面量同步)
 * @returns 子应用 origin 前缀(如 http://localhost:7201)
 */
function appDomain(port: number): string {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `http://${hostname}:${port}`;
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
    domain: appDomain(7201),
    color: "#5b8ff9",
    defaultLayout: "workspace",
    menu: [
      { label: "首页", path: "/" },
      { label: "产品", path: "/products" },
    ],
  },
  {
    key: "sub-b",
    name: "子应用 B",
    domain: appDomain(7202),
    color: "#52c41a",
    defaultLayout: "workspace",
    menu: [
      { label: "首页", path: "/" },
      { label: "通信演示", path: "/about" },
    ],
  },
  {
    key: "sub-demo",
    name: "测试 Demo",
    domain: appDomain(7204),
    color: "#722ed1",
    defaultLayout: "workspace",
    menu: [
      { label: "布局演示", path: "/" },
      { label: "表格页", path: "/table" },
      { label: "表单页", path: "/form" },
    ],
  },
];

/** 授权网关子应用:不进 Tab 注册表(无菜单/Tab),仅 host 在未登录时以全屏容器 startApp */
export const authApp: MicroApp = {
  key: "auth",
  name: "授权网关",
  domain: appDomain(7203),
  color: "#fa8c16",
};
