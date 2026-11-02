/**
 * 契约与类型入口(host 与子应用共用)。
 * 运行时 helper:主应用用 "@repo/wujie-kit/host",子应用用 "@repo/wujie-kit/sub"。
 */
import "./globals";

export { appEvents } from "./events";
export type {
  BroadcastPayload,
  HostStatePayload,
  TabOpenPayload,
  TabRoutePayload,
  TabTitlePayload,
} from "./events";
export type { HostProps, MicroApp, SubAppConfig, SyncBus, TabInfo } from "./types";
