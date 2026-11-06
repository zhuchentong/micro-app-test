import type { Pinia } from "pinia";
import { useThemeStore } from "@repo/store";
import { applyTheme, toThemeMode } from "@repo/themes";

/**
 * 主题兜底:嵌入模式由 host 写 :root 经继承穿透,子应用不参与;
 * 独立运行(无 $wujie)时自行应用 preset,保证 fallback 观感一致。
 * @param pinia 显式传入(piniaSetup 返回值),不依赖活跃实例时序
 */
export function themeSetup(pinia: Pinia): void {
  if (typeof window !== "undefined" && !window.$wujie) {
    applyTheme(document.documentElement, toThemeMode(useThemeStore(pinia).theme));
  }
}
