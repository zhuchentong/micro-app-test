import { createAppBus } from "@repo/wujie-kit/sub";
import { appConfig } from "./app.config";

/** 子应用 bus 组合根(模块级单例:页面共享同一 lastBroadcast 与监听状态;无路由:不接纠偏) */
export const { subBus } = createAppBus(appConfig);
