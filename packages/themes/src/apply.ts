import { themePresets, themeVars } from "./tokens.ts";
import type { ThemeMode } from "./tokens.ts";

/**
 * 将主题 preset 应用到指定根元素:
 * - 嵌入模式:host 传宿主 document.documentElement(变量经继承穿透到子应用 DOM);
 * - 独立运行:子应用传自身 document.documentElement(preset 值兜底)。
 * 同时写 data-theme 供未来暗色变体选择器使用。
 */
export function applyTheme(root: HTMLElement, mode: ThemeMode): void {
  const values = themePresets[mode];
  root.setAttribute("data-theme", mode);
  // tu-design(shadcn) tokens 以 .dark class 策略切换暗色(tokens.css @custom-variant);data-theme 保留明暗语义
  root.classList.toggle("dark", mode === "dark");
  for (const name of themeVars) {
    root.style.setProperty(name, values[name]);
  }
}

/**
 * 宽松收窄:themeStore 同步链路上的 mode 为 string(跨 bus 契约),未知值回落 light。
 * 供 applyTheme 调用方在边界处使用。
 */
export function toThemeMode(value: string): ThemeMode {
  return value === "dark" ? "dark" : "light";
}
