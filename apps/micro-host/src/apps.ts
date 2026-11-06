import type { MenuGroup, MicroApp } from "@repo/wujie-kit";
import { microAppEntries } from "virtual:micro-app-registry";

// 菜单形状上移到 bus 契约(host 静态兜底与子应用上报共用同一类型)
export type { MenuEntry, MenuGroup } from "@repo/wujie-kit";

import type { LayoutName } from "./stores/layout";

/** host 注册表条目:子应用元信息 + 侧栏菜单 + 布局偏好 */
export interface HostApp extends MicroApp {
  menu: MenuGroup[];
  /** 该子应用的默认布局:打开新 Tab 时应用;已有 Tab 之间的激活不改变布局 */
  defaultLayout: LayoutName;
}

/**
 * 子应用 domain:跟随宿主被访问的地址(本机 localhost / 局域网 IP 直访均可用,
 * 支持把宿主入口 URL 分享给局域网协作者查看)。
 * 前提:子应用与宿主同机、不同端口;未来若改为同域 path 分发,需引入环境变量覆盖。
 * node 测试环境无 window(tabs.test.ts 以桩替换),回退 localhost 保持断言基线不变。
 * @param port 子应用 vite dev 端口(注册聚合插件自各子应用 vite.config.ts 字面量提取)
 * @returns 子应用 origin 前缀(如 http://localhost:7201)
 */
function appDomain(port: number): string {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `http://${hostname}:${port}`;
}

/**
 * 子应用注册表(事件契约见 @repo/wujie-kit 的 appEvents)。
 * 单源 = 各子应用 app.manifest.json(身份:MicroAppManifest)+ 各 vite.config.ts 的
 * server.port 字面量(端口),由 @repo/config-vite 的 microAppRegistryPlugin 配置加载期
 * 聚合后经 virtual:micro-app-registry 注入:新增子应用零登记(建目录 + manifest 即生效;
 * 改动 manifest 后需重启 host dev)。
 */
export const apps: HostApp[] = microAppEntries
  .filter((entry) => entry.mode !== "gateway")
  .map((entry) => ({
    key: entry.key,
    name: entry.name,
    domain: appDomain(entry.port),
    color: entry.accent,
    // 布局偏好当前全部 workspace;如需 per-app 差异,在 MicroAppManifest 增补字段即可
    defaultLayout: "workspace" as LayoutName,
    menu: entry.menu ?? [],
  }));

/** 授权网关子应用:不进 Tab 注册表(无菜单/Tab),仅 host 在未登录时以全屏容器 startApp */
const gatewayEntry = microAppEntries.find((entry) => entry.mode === "gateway");
if (!gatewayEntry) {
  throw new Error("[apps] 缺少 mode=gateway 的 app.manifest.json(授权网关身份单源缺失)");
}
export const authApp: MicroApp = {
  key: gatewayEntry.key,
  name: gatewayEntry.name,
  domain: appDomain(gatewayEntry.port),
  color: gatewayEntry.accent,
};
