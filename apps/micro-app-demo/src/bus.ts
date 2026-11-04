import { createSubBus } from "@repo/wujie-kit/sub";
import { appConfig } from "./app.config";

/** 子应用 bus 能力组合根(模块级单例:页面共享同一监听状态) */
export const subBus = createSubBus(appConfig);
