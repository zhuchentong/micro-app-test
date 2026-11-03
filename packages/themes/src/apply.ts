import { themePresets, themeVars } from "./tokens.ts";
import type { ThemeMode, ThemeVarName } from "./tokens.ts";

/** 自定义 token 覆盖:键为 --app-* 变量名,undefined 项忽略 */
export type ThemeOverrides = Partial<Record<ThemeVarName, string>>;

/**
 * 将主题 preset 应用到指定根元素:
 * - 嵌入模式:host 传宿主 document.documentElement(变量经继承穿透到子应用 DOM);
 * - 独立运行:子应用传自身 document.documentElement(preset 值兜底)。
 * 同时写 data-theme 供未来暗色变体选择器使用。
 *
 * @param root CSS 变量写入的目标根元素(嵌入模式传宿主,独立运行传自身)
 * @param mode 明暗模式(preset 取值键,同时写入 data-theme 与 .dark class)
 * @param overrides 自定义 token 覆盖(host 权威源下发,在 preset 全量写入后覆盖;
 *                  preset 每次全量重写,清空 overrides 即自然回落内置值)
 */
export function applyTheme(root: HTMLElement, mode: ThemeMode, overrides?: ThemeOverrides): void {
  const values = themePresets[mode];
  root.setAttribute("data-theme", mode);
  // tu-design(shadcn) tokens 以 .dark class 策略切换暗色(tokens.css @custom-variant);data-theme 保留明暗语义
  root.classList.toggle("dark", mode === "dark");
  for (const name of themeVars) {
    root.style.setProperty(name, values[name]);
  }
  if (!overrides) return;
  for (const [name, value] of Object.entries(overrides)) {
    if (value !== undefined) root.style.setProperty(name, value);
  }
}

/**
 * 宽松收窄:themeStore 同步链路上的 mode 为 string(跨 bus 契约),未知值回落 light。
 * 供 applyTheme 调用方在边界处使用。
 * @param value 同步链路上的原始模式字符串
 * @returns 收窄后的 ThemeMode(仅 "dark" 判为 dark,其余一律 light)
 */
export function toThemeMode(value: string): ThemeMode {
  return value === "dark" ? "dark" : "light";
}
