import type { MicroApp } from "@repo/wujie-kit";

/** 子应用注册表(事件契约见 @repo/wujie-kit 的 appEvents) */
export const apps: MicroApp[] = [
  { key: "sub-a", name: "子应用 A", domain: "http://localhost:7201", color: "#5b8ff9" },
  { key: "sub-b", name: "子应用 B", domain: "http://localhost:7202", color: "#52c41a" },
];
