/**
 * 主题 token 单源:全部 CSS 变量名与 light/dark 内置值。
 *
 * 架构约定:wujie 非 shadowDOM 下子应用 DOM 位于宿主 document,CSS 自定义属性
 * 自 :root 继承即完成跨应用穿透 —— host 为唯一写入方,子应用只消费不定义。
 * 变量值修订只改本文件(或未来 host 运行时覆盖),子应用无需重新部署。
 */

/** 主题模式:host themeStore 同步的取值域 */
export type ThemeMode = "light" | "dark";

/** 全部主题 CSS 变量名(写入方与消费方共用的唯一命名来源) */
export const themeVars = [
  "--app-bg-page",
  "--app-bg-surface",
  "--app-bg-raised",
  "--app-bg-hover",
  "--app-bg-tab-inactive",
  "--app-header-bg",
  "--app-border",
  "--app-text-1",
  "--app-text-2",
  "--app-text-3",
  "--app-accent",
  "--app-accent-contrast",
  "--app-accent-soft",
  "--app-accent-soft-border",
  "--app-brand",
  "--app-brand-soft",
] as const;

export type ThemeVarName = (typeof themeVars)[number];
export type ThemeTokenValues = Record<ThemeVarName, string>;

/**
 * 内置 preset(light/dark)。
 * 值归一说明:原三端本地定义存在 7 处分歧(详见迁移记录),此处统一为单一色阶:
 * dark 层级 page(#0b1220) < surface(#111827) < raised(#1f2937);
 * 文本取高对比侧(text-1 light #111827 / dark #f9fafb)。
 */
export const themePresets: Record<ThemeMode, ThemeTokenValues> = {
  light: {
    "--app-bg-page": "#ffffff",
    "--app-bg-surface": "#f9fafb",
    "--app-bg-raised": "#ffffff",
    "--app-bg-hover": "#f3f4f6",
    "--app-bg-tab-inactive": "#f9fafb",
    "--app-header-bg": "#ffffff",
    "--app-border": "#e5e7eb",
    "--app-text-1": "#111827",
    "--app-text-2": "#6b7280",
    "--app-text-3": "#9ca3af",
    "--app-accent": "#4f46e5",
    "--app-accent-contrast": "#ffffff",
    "--app-accent-soft": "#eef2ff",
    "--app-accent-soft-border": "#c7d2fe",
    "--app-brand": "#3273dc",
    "--app-brand-soft": "#eaf1fd",
  },
  dark: {
    "--app-bg-page": "#0b1220",
    "--app-bg-surface": "#111827",
    "--app-bg-raised": "#1f2937",
    "--app-bg-hover": "#1f2937",
    "--app-bg-tab-inactive": "#0b1220",
    "--app-header-bg": "#111827",
    "--app-border": "#1f2937",
    "--app-text-1": "#f9fafb",
    "--app-text-2": "#9ca3af",
    "--app-text-3": "#6b7280",
    "--app-accent": "#c7d2fe",
    "--app-accent-contrast": "#0b1220",
    "--app-accent-soft": "#312e81",
    "--app-accent-soft-border": "#4338ca",
    "--app-brand": "#3273dc",
    "--app-brand-soft": "#eaf1fd",
  },
};
