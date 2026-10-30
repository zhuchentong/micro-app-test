import type { HostProps, MicroApp } from "./types";

/**
 * wujie startApp 的结构类型 —— 本包不依赖 wujie,
 * 由主应用注入真实实现(startApp),子应用构建产物中不含任何 wujie 代码。
 */
export interface StartAppOptions {
  name: string;
  url: string;
  el: string;
  sync?: boolean;
  /** 保活模式:切走保留 iframe 与状态,切回不重新挂载(改 url 不能跳子应用路由) */
  alive?: boolean;
  props?: HostProps;
  loadError?: (url: string, error: unknown) => void;
}

export type StartAppFn = (options: StartAppOptions) => unknown;

/** parseLocation 的解析结果 */
export interface ParsedLocation {
  app?: string;
  path?: string;
}

/**
 * 解析 wujie sync 写入的 ?{appKey}={path} 参数。
 * 行为契约:跳过 token 参数;空 path 默认 "/";未注册的 key 忽略。
 *
 * @param search location.search
 * @param apps   主应用注册表
 */
export function parseLocation(search: string, apps: MicroApp[]): ParsedLocation {
  const params = new URLSearchParams(search);
  for (const [key, value] of params) {
    if (key === "token") continue;
    if (apps.some((app) => app.key === key)) return { app: key, path: value || "/" };
  }
  return {};
}

export interface StarterOptions {
  /** wujie 的 startApp(主应用注入) */
  startApp: StartAppFn;
  /** 主应用注册表 */
  apps: MicroApp[];
  /** 经 props 注入给子应用的数据;传函数则每次启动时求值,取最新状态 */
  props: HostProps | (() => HostProps);
  /** 子应用挂载容器,默认 "#app-container" */
  el?: string;
  /** 保活模式(透传 startApp),默认不保活 */
  alive?: boolean;
  /** 加载失败回调;缺省时打印到控制台 */
  onError?: (app: MicroApp, url: string, error: unknown) => void;
  /** 子应用 startApp 调用后的钩子,如补发状态快照 */
  onStarted?: (app: MicroApp, url: string) => void;
}

/** 创建主应用的子应用启动器(sync 路由由 wujie 内部处理) */
export function createMicroAppStarter(
  options: StarterOptions,
): (key: string, path?: string) => void {
  const { startApp, apps, props, el = "#app-container", alive, onError, onStarted } = options;

  return (key, path = "/") => {
    const app = apps.find((item) => item.key === key);
    if (!app) {
      console.error(`[wujie] 未注册的子应用: ${key}`);
      return;
    }

    const resolvedProps = typeof props === "function" ? props() : props;
    const url = `${app.domain}${path}`;

    void startApp({
      name: app.key,
      url,
      el,
      sync: true,
      alive,
      props: resolvedProps,
      loadError: (loadUrl, error) => {
        if (onError) onError(app, loadUrl, error);
        else console.error(`[wujie] ${app.name} 加载失败: ${loadUrl}`, error);
      },
    });

    onStarted?.(app, url);
  };
}
