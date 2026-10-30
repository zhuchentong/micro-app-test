import type { SubAppConfig } from "@repo/wujie-kit";

/** 应用标识与主题色(实例数据;bus 事件契约统一由 @repo/wujie-kit 提供) */
export const appConfig = {
  name: "子应用 A",
  accent: "#5b8ff9",
} as const satisfies SubAppConfig;
