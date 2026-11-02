import { createUnoConfig } from "@repo/config/unocss";

// 供 @vizejs/vite-plugin 内置 unocss 与各 app 的 UnoCSS() 经 unconfig 向上查找统一命中,
// 消除 "Config file not found" 告警;theme/preset 与三个 app 共享同一份定义
export default createUnoConfig();
