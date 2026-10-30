/** 主/子应用 bus 事件契约(单一来源,三端共用) */
export const appEvents = {
  /** 子应用 → 主应用:页面标题同步 */
  title: "sub:title",
  /** 子应用 → 主应用:通知消息 */
  notify: "sub:notify",
  /** 主应用 → 子应用:广播 */
  broadcast: "host:broadcast",
  /** 主应用 → 子应用:store 状态快照 */
  state: "host:state",
  /** 子应用 → 主应用:请求一次状态快照(子应用监听注册后的握手) */
  stateRequest: "sub:state-request",
} as const;

/** host:broadcast 事件 payload */
export interface BroadcastPayload {
  text?: string;
  from?: string;
}

/** host:state 事件 payload(store 状态快照) */
export interface HostStatePayload {
  user: { id: string; name: string };
  theme: string;
  /** 单调递增序号,子应用据此丢弃过期/乱序事件 */
  rev: number;
}
