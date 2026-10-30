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
 * @deprecated 单容器 sync 模式遗留;多 Tab 模式地址栏由主应用自管,请用 parseTabUrl
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

// ---------------------------------------------------------------------------
// 多 Tab 模式:一 Tab 一实例(保活),地址栏由主应用自管(实例 sync: false)
// ---------------------------------------------------------------------------

/** Tab 状态机:cold=无实例(未创建/LRU 销毁/刷新恢复),background=有保活实例,active=当前显示 */
export type TabState = "cold" | "background" | "active";

/** parseTabUrl 的解析结果 */
export interface ParsedTabUrl {
  app?: string;
  page?: string;
  query?: Record<string, string>;
}

/** 解析 Tab URL 中的 query:跳过 token,数组取首值 */
function parseQueryParams(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    if (key === "token" || key in query) continue;
    query[key] = value;
  }
  return query;
}

/**
 * 确定性生成 tabId(去重键):`app|page|排序后的 query`。
 * 同参数必然同 id —— 子应用重复 emit tabOpen 自然幂等,无需回执。
 * token 参数不参与(与 parseLocation 契约一致)。
 */
export function buildTabKey(app: string, page: string, query?: Record<string, string>): string {
  const qs = Object.entries(query ?? {})
    .filter(([key]) => key !== "token")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `${app}|${page}|${qs}`;
}

/**
 * 解析主应用自管地址 `//{app}/{page}?{query}`,校验 app 已注册。
 * 实例级 sync 已关闭(wujie 不再写 ?{name}=…),该函数替代 parseLocation。
 *
 * @param url  完整地址(协议可缺省,便于传 pathname+search)
 * @param apps 主应用注册表
 */
export function parseTabUrl(url: string, apps: MicroApp[]): ParsedTabUrl {
  const parsed = new URL(url, "http://wujie.invalid");
  const segments = parsed.pathname.replace(/^\/+/, "").split("/");
  const [appKey, ...rest] = segments;
  if (!appKey || !apps.some((app) => app.key === appKey)) return {};
  return {
    app: appKey,
    page: rest.length > 0 ? `/${rest.join("/")}` : "/",
    query:
      Object.keys(parseQueryParams(parsed.search)).length > 0
        ? parseQueryParams(parsed.search)
        : undefined,
  };
}

/** 拼接子应用 url(与 buildTabKey 的 query 语义一致) */
export function buildTabUrl(domain: string, page: string, query?: Record<string, string>): string {
  const qs = new URLSearchParams(query).toString();
  if (!qs) return `${domain}${page}`;
  return `${domain}${page}${page.includes("?") ? "&" : "?"}${qs}`;
}

/** startTabApp 的入参 tab 定义(主应用 Tab store 的一条记录投影) */
export interface TabDescriptor {
  id: string;
  app: string;
  page: string;
  query?: Record<string, string>;
  /** 挂载容器选择器,如 "#host-tab-3"(每 Tab 一个,由主应用创建) */
  el: string;
}

/** tabId → 合法实例 name 后缀(FNV-1a 32 位,确定性且不含 wujie name 非法的字符) */
function tabNameSuffix(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.codePointAt(i)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Tab 实例 name(全局唯一;startTabApp 与 host 销毁/查重共用同一映射) */
export function tabInstanceName(app: string, id: string): string {
  return `${app}-tab-${tabNameSuffix(id)}`;
}

export interface TabAppOptions {
  /** wujie 的 startApp(主应用注入) */
  startApp: StartAppFn;
  /** 主应用注册表 */
  apps: MicroApp[];
  /** 业务快照(user/theme),函数形式每次启动求值,保证重建时取最新状态 */
  baseProps: Omit<HostProps, "tab"> | (() => Omit<HostProps, "tab">);
  tab: TabDescriptor;
  /** 保活(透传 startApp);Tab 模式恒为 true */
  alive?: boolean;
  onError?: (tab: TabDescriptor, url: string, error: unknown) => void;
  onStarted?: (tab: TabDescriptor, url: string) => void;
}

/**
 * 按 Tab 启动一个 wujie 实例:name 全局唯一(app-tab-{id 尾段}),sync 关闭,alive 保活。
 * 同 page 不同参数 → 不同 tabId → 不同实例,天然隔离(官方 Issue #391/#516 约束)。
 */
export function startTabApp(options: TabAppOptions): void {
  const { startApp, apps, baseProps, tab, alive = true, onError, onStarted } = options;
  const app = apps.find((item) => item.key === tab.app);
  if (!app) {
    console.error(`[wujie] 未注册的子应用: ${tab.app}`);
    return;
  }

  const resolvedBase = typeof baseProps === "function" ? baseProps() : baseProps;
  const url = buildTabUrl(app.domain, tab.page, tab.query);

  void startApp({
    // wujie 实例 name 全局唯一;tabId 含非安全字符,经确定性 hash 生成合法 name
    name: tabInstanceName(app.key, tab.id),
    url,
    el: tab.el,
    sync: false,
    alive,
    props: { ...resolvedBase, tab: { id: tab.id, app: tab.app, page: tab.page } },
    loadError: (loadUrl, error) => {
      if (onError) onError(tab, loadUrl, error);
      else console.error(`[wujie] ${app.name}(${tab.id}) 加载失败: ${loadUrl}`, error);
    },
  });

  onStarted?.(tab, url);
}
