import { createAppBus } from "@repo/wujie-kit/sub";
import { appConfig } from "./app.config";
import router from "./router";

/** 子应用 bus 组合根(模块级单例:页面共享同一 lastBroadcast 与监听状态;含纠偏接线与 openTab 导航约定) */
export const { appBus, openTab } = createAppBus(appConfig, router);
