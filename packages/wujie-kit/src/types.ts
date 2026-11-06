import type { MenuGroup } from "./events";

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

/**
 * 子应用身份单源声明(app.manifest.json 的形状):
 * host 注册表聚合(microAppRegistryPlugin)与子应用 bus 契约共用。
 * 字段校验在 @repo/config-vite 的注册聚合插件配置加载期执行(缺字段快速失败)。
 */
export interface MicroAppManifest {
  /** 注册表唯一键:Tab 持久化身份(localStorage),创建后不可改名;新建应用约定 = 目录名 */
  key: string;
  /** 展示名:Tab 标题、侧栏应用名 */
  name: string;
  /** 主题强调色:host 注册表 color 与子应用 accent 的单源 */
  accent: string;
  /** 侧栏菜单:既是 host 静态兜底也是子应用上报内容(上报按 key 幂等覆盖);缺省 = 无菜单 */
  menu?: MenuGroup[];
  /** 应用形态:缺省/"tab" = 进 Tab 注册表;"gateway" = 全屏网关(不进 Tab 注册表,如授权网关) */
  mode?: "tab" | "gateway";
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

/**
 * 共享依赖运行时:host 的 public/generated/shared-deps.js 挂载,子应用经 jsBeforeLoaders
 * 从 window.parent 注入引用。框架命名空间按 unknown 弱类型化,避免本包与框架版本耦合。
 */
export interface MicroSharedRuntime {
  vue: unknown;
  pinia: unknown;
  vueRouter: unknown;
  /** 共享 bundle 生成时的解析版本(根 scripts/build-shared.mjs 注入) */
  version: { vue: string; pinia: string; vueRouter: string };
}

declare global {
  interface Window {
    __MICRO_SHARED__?: MicroSharedRuntime;
  }
  /**
   * 子应用构建期期望的共享依赖版本(@repo/config-vite 工厂 define 注入;
   * 独立构建/旧产物缺失时,sub.ts 的版本漂移检查自动跳过)。
   * 用 var 而非 const:多 app 虚拟项目合并诊断时环境声明需可合并(const 会 TS2451)。
   */
  var __MICRO_SHARED_VERSIONS__: Record<string, string> | undefined;
}
