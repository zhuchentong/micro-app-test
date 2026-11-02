import { defineConfig, presetWind3 } from "unocss";
import type { UserConfig } from "unocss";

// 共享主题 token:三个 app 使用同一 preset/theme,保证同名工具类语义一致,
// wujie 非 shadowDOM 场景下 host 与子应用样式混排也不会互相矛盾
const theme = {
  colors: {
    brand: "#3273dc",
    "brand-soft": "#eaf1fd",
  },
} satisfies UserConfig["theme"];

export function createUnoConfig(overrides: UserConfig = {}) {
  return defineConfig({
    presets: [presetWind3({ preflight: false })],
    theme,
    ...overrides,
  });
}

export default createUnoConfig;
