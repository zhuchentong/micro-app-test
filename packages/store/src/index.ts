/**
 * 共享 pinia store 与 host→子应用单向同步入口。
 * 运行时 helper:host 用 "@repo/store/host",子应用用 "@repo/store/sub"。
 */
export { useThemeStore } from "./stores/theme";
export { useUserStore } from "./stores/user";
export { createHostStoreSync } from "./host";
export type { HostStoreSync } from "./host";
export { createSubStoreSync } from "./sub";
export type { SubStoreSync } from "./sub";
