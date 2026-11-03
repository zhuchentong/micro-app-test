/** 主/子应用 bus 事件契约(单一来源,三端共用) */
export const appEvents = {
  /** 子应用 → 主应用:页面标题同步(单容器模式遗留,Tab 模式改用 tabTitle) */
  title: "sub:title",
  /** 子应用 → 主应用:通知消息 */
  notify: "sub:notify",
  /** 主应用 → 子应用:广播 */
  broadcast: "host:broadcast",
  /** 主应用 → 子应用:store 状态快照 */
  state: "host:state",
  /** 子应用 → 主应用:请求一次状态快照(子应用监听注册后的握手) */
  stateRequest: "sub:state-request",
  /** 子应用 → 主应用:请求打开 Tab(幂等:同 app+page+query 复用已有 Tab) */
  tabOpen: "host:tab-open",
  /** 子应用 → 主应用:Tab 内路由变化(替代 sync;地址栏由主应用自管) */
  tabRoute: "host:tab-route",
  /** 子应用 → 主应用:Tab 标题回报(document.title 仅跟随激活 Tab) */
  tabTitle: "host:tab-title",
  /** 子应用 → 主应用:上报侧栏菜单(host 静态注册为兜底,上报后覆盖) */
  menu: "sub:menu",
} as const;

/** host:broadcast 事件 payload */
export interface BroadcastPayload {
  text?: string;
  from?: string;
  /** 定向 target(tabId);缺省 = 广播给所有保活实例 */
  target?: string;
}

/** host:state 事件 payload(store 状态快照) */
export interface HostStatePayload {
  user: { id: string; name: string };
  theme: string;
  /**
   * 自定义主题 token 覆盖(键为 --app-* CSS 变量名)。
   * host 永远下发(可能为空对象):旧 host 缺省该字段时子应用按空覆盖处理,
   * 保持向后兼容。applyTheme 在 preset 全量写入后应用覆盖。
   */
  custom?: Record<string, string>;
  /** 单调递增序号,子应用据此丢弃过期/乱序事件 */
  rev: number;
}

/** host:tab-open 事件 payload;tabId 由主应用确定性生成,子应用无需回执 */
export interface TabOpenPayload {
  /** 注册表 app key(来自注入的 props.tab.app) */
  app: string;
  /** 页面路径 */
  page: string;
  /** 业务参数 */
  query?: Record<string, string>;
}

/** host:tab-route 事件 payload(其余导航由 sync 关闭后改走此通道) */
export interface TabRoutePayload {
  /** 注入的 props.tab.id */
  id: string;
  page: string;
  query?: Record<string, string>;
}

/** host:tab-title 事件 payload;host 仅信任激活 Tab 的标题,防多实例互抢 */
export interface TabTitlePayload {
  id: string;
  title: string;
}

/** 侧栏菜单项(host 静态注册与子应用上报共用同一形状) */
export interface MenuEntry {
  label: string;
  path: string;
  query?: Record<string, string>;
}

/** sub:menu 事件 payload;host 按 app key 覆盖静态兜底菜单,重复上报幂等 */
export interface MenuReportPayload {
  /** 注册表 app key(来自注入的 props.tab.app) */
  app: string;
  menu: MenuEntry[];
}
