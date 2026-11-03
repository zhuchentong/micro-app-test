import type { MenuEntry } from "./events";

/** 主/子应用 bus 最小结构接口(wujie 导出的 bus 结构兼容,必要时由调用方断言) */
export interface SyncBus {
  $emit(event: string, data?: unknown): void;
  $on<T = unknown>(event: string, callback: (data?: T) => void): void;
  $off(event: string, callback?: (data?: unknown) => void): void;
}

/** 主应用注册表条目 */
export interface MicroApp {
  key: string;
  name: string;
  domain: string;
  color: string;
}

/** 子应用自身标识配置 */
export interface SubAppConfig {
  name: string;
  accent: string;
  /** 侧栏菜单上报内容(App.vue 组合根处 reportMenu 上报;缺省则 host 用静态兜底) */
  menu?: MenuEntry[];
}

/** Tab 身份信息:由主应用确定性生成,经 startApp props 注入子应用 */
export interface TabInfo {
  /** 确定性 tabId(由 app + page + query 编码,host 侧去重键) */
  id: string;
  /** 注册表 app key(子应用上报 openTab 时回传,消除归属歧义) */
  app: string;
  /** 打开 Tab 时的页面路径 */
  page: string;
}

/** 主应用经 startApp props 注入的数据 */
export interface HostProps {
  user: { id: string; name: string };
  theme: string;
  /** Tab 模式注入;传统单容器模式/独立运行时为 undefined */
  tab?: TabInfo;
}
