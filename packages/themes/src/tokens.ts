/**
 * 主题 token 单源:全部 CSS 变量名与 light/dark 内置值。
 *
 * 架构约定:wujie 非 shadowDOM 下子应用 DOM 位于宿主 document,CSS 自定义属性
 * 自 :root 继承即完成跨应用穿透 —— host 为唯一写入方,子应用只消费不定义。
 * 变量值修订只改本文件(或未来 host 运行时覆盖),子应用无需重新部署。
 *
 * 色彩源:兔博士工作台 DESIGN SYSTEM v2.0(青色系,规范仅定义 light)。
 * - primitive 色板(brandPalette/neutralPalette/statusPalette/dataPalette)为唯一色彩源,
 *   语义层 --app-* 一律由色板映射,禁止散落字面值;
 * - dark preset 为推导值:中性色反转、青色信号保留(hover/deep 反向提亮)、
 *   浅底用同色 hex8 低透明(约 15%);状态实色两种模式一致;
 * - 状态色命名对齐 tu-design 上游语义(destructive,非 danger);
 * - data 图表色规范规定按序号固定取用,明暗两套同值。
 */

export type ThemeMode = "light" | "dark";

/* ===== primitive 色板(规范 v2.0 唯一色彩源) ===== */

/** Brand 主色族:primary 主按钮唯一实底配白字;hover 深阶;deep 仅文字/图标/1px 描边小元素 */
export const brandPalette = {
  primary: "#20c1e9",
  hover: "#12a5c6",
  deep: "#09748f",
  deepAlt: "#0a7c99",
  light1: "#7edcf0",
  light2: "#bfe6f2",
  softBg: "#e6f7fc",
  softBgAlt: "#f1fafd",
} as const;

/** Neutral 中性族:canvas 画布底;border 1px 描边;text2 次级文本;text1 主文本 */
export const neutralPalette = {
  white: "#ffffff",
  n25: "#f5fafd",
  n50: "#f1fafd",
  canvas: "#edf4f9",
  n100: "#e8eef4",
  n150: "#e9edf2",
  n200: "#dce8f2",
  border: "#d8e7ef",
  weak: "#a9bac6",
  n600: "#738c9c",
  text2: "#55707f",
  text1: "#12304a",
} as const;

/** Semantic 状态族:实色 + 浅底成对;仅用于状态反馈,不做装饰 */
export const statusPalette = {
  destructive: "#e06666",
  destructiveSoft: "#fdecec",
  success: "#12b981",
  successSoft: "#eff8f5",
  warning: "#f0932b",
  warningSoft: "#fdf2e4",
  info: "#3d7fc1",
  infoSoft: "#eaf3fc",
} as const;

/** Data 图表族:按序号固定取用(data-1..8),明暗同值 */
export const dataPalette = [
  "#20c1e9",
  "#3d7fc1",
  "#12b981",
  "#f0932b",
  "#976dfa",
  "#fc706a",
  "#d8e7ef",
  "#eff4f8",
] as const;

/** dark 推导:中性反转 + 青色信号保留(hover/deep 反向提亮)+ 浅底 hex8 低透明 */
const darkSurface = {
  canvas: "#0b1e2c",
  surface: "#122b3c",
  raised: "#1a3548",
  hover: "#0f3346",
  border: "#24455c",
  text1: "#e6f1f7",
  text2: "#9fb6c4",
  text3: "#6e8899",
} as const;
const darkBrand = {
  accentHover: "#3fcfee",
  accentDeep: "#7edcf0",
  accentSoft: "#20c1e926",
  accentSoftBorder: "#20c1e94d",
} as const;
/**
 * dark 状态浅底:同色 hex8 约 15% alpha
 * @param hex 6 位 hex 实色
 * @returns 8 位 hex 浅底
 */
const darkSoft = (hex: string) => `${hex}26`;
const darkStatus = {
  destructive: statusPalette.destructive,
  destructiveSoft: darkSoft(statusPalette.destructive),
  success: statusPalette.success,
  successSoft: darkSoft(statusPalette.success),
  warning: statusPalette.warning,
  warningSoft: darkSoft(statusPalette.warning),
  info: statusPalette.info,
  infoSoft: darkSoft(statusPalette.info),
} as const;

/** 全部主题 CSS 变量名(写入方与消费方共用的唯一命名来源) */
export const themeVars = [
  // 表面/结构
  "--app-bg-page",
  "--app-bg-surface",
  "--app-bg-raised",
  "--app-bg-hover",
  "--app-bg-tab-inactive",
  "--app-header-bg",
  "--app-border",
  // 文本
  "--app-text-1",
  "--app-text-2",
  "--app-text-3",
  // 品牌信号
  "--app-accent",
  "--app-accent-contrast",
  "--app-accent-hover",
  "--app-accent-deep",
  "--app-accent-soft",
  "--app-accent-soft-border",
  "--app-brand",
  "--app-brand-soft",
  // 状态(destructive 命名对齐 tu-design 上游)
  "--app-destructive",
  "--app-destructive-soft",
  "--app-success",
  "--app-success-soft",
  "--app-warning",
  "--app-warning-soft",
  "--app-info",
  "--app-info-soft",
  // 数据图表(按序号固定取用)
  "--app-data-1",
  "--app-data-2",
  "--app-data-3",
  "--app-data-4",
  "--app-data-5",
  "--app-data-6",
  "--app-data-7",
  "--app-data-8",
] as const;

export type ThemeVarName = (typeof themeVars)[number];
export type ThemeTokenValues = Record<ThemeVarName, string>;

/** data-1..8 语义变量(明暗同值;显式键名保证 ThemeTokenValues 精确类型) */
const dataTokens = {
  "--app-data-1": dataPalette[0],
  "--app-data-2": dataPalette[1],
  "--app-data-3": dataPalette[2],
  "--app-data-4": dataPalette[3],
  "--app-data-5": dataPalette[4],
  "--app-data-6": dataPalette[5],
  "--app-data-7": dataPalette[6],
  "--app-data-8": dataPalette[7],
} as const satisfies Partial<Record<ThemeVarName, string>>;

/**
 * 内置 preset(light=规范值,dark=推导值)。
 * 圆角/间距/阴影/字体等静态非颜色令牌在 tokens.css 本地段定义,不经 applyTheme 覆盖。
 */
export const themePresets: Record<ThemeMode, ThemeTokenValues> = {
  light: {
    "--app-bg-page": neutralPalette.canvas,
    "--app-bg-surface": neutralPalette.white,
    "--app-bg-raised": neutralPalette.n25,
    "--app-bg-hover": brandPalette.softBgAlt,
    "--app-bg-tab-inactive": neutralPalette.n25,
    "--app-header-bg": neutralPalette.white,
    "--app-border": neutralPalette.border,
    "--app-text-1": neutralPalette.text1,
    "--app-text-2": neutralPalette.text2,
    "--app-text-3": neutralPalette.n600,
    "--app-accent": brandPalette.primary,
    "--app-accent-contrast": neutralPalette.white,
    "--app-accent-hover": brandPalette.hover,
    "--app-accent-deep": brandPalette.deep,
    "--app-accent-soft": brandPalette.softBg,
    "--app-accent-soft-border": brandPalette.light2,
    "--app-brand": brandPalette.primary,
    "--app-brand-soft": brandPalette.softBg,
    "--app-destructive": statusPalette.destructive,
    "--app-destructive-soft": statusPalette.destructiveSoft,
    "--app-success": statusPalette.success,
    "--app-success-soft": statusPalette.successSoft,
    "--app-warning": statusPalette.warning,
    "--app-warning-soft": statusPalette.warningSoft,
    "--app-info": statusPalette.info,
    "--app-info-soft": statusPalette.infoSoft,
    ...dataTokens,
  },
  dark: {
    "--app-bg-page": darkSurface.canvas,
    "--app-bg-surface": darkSurface.surface,
    "--app-bg-raised": darkSurface.raised,
    "--app-bg-hover": darkSurface.hover,
    "--app-bg-tab-inactive": darkSurface.canvas,
    "--app-header-bg": darkSurface.surface,
    "--app-border": darkSurface.border,
    "--app-text-1": darkSurface.text1,
    "--app-text-2": darkSurface.text2,
    "--app-text-3": darkSurface.text3,
    // 青色信号保留,对比度靠 contrast 白字
    "--app-accent": brandPalette.primary,
    "--app-accent-contrast": neutralPalette.white,
    "--app-accent-hover": darkBrand.accentHover,
    "--app-accent-deep": darkBrand.accentDeep,
    "--app-accent-soft": darkBrand.accentSoft,
    "--app-accent-soft-border": darkBrand.accentSoftBorder,
    "--app-brand": brandPalette.primary,
    "--app-brand-soft": darkBrand.accentSoft,
    "--app-destructive": darkStatus.destructive,
    "--app-destructive-soft": darkStatus.destructiveSoft,
    "--app-success": darkStatus.success,
    "--app-success-soft": darkStatus.successSoft,
    "--app-warning": darkStatus.warning,
    "--app-warning-soft": darkStatus.warningSoft,
    "--app-info": darkStatus.info,
    "--app-info-soft": darkStatus.infoSoft,
    ...dataTokens,
  },
};
