import { defineStore } from "pinia";

/**
 * 共享主题 store:host 为权威源,子应用为副本(同一份定义,各自 pinia 实例化)。
 * custom 为自定义 token 覆盖(--app-* 变量名 → 值),走同一同步通道整体替换。
 */
export const useThemeStore = defineStore("theme", {
  state: () => ({
    theme: "light",
    custom: {} as Record<string, string>,
  }),
  actions: {
    setTheme(theme: string): void {
      this.theme = theme;
    },
    /**
     * 整体替换自定义覆盖(传空对象即清除,applyTheme 回落内置 preset)
     * @param custom --app-* 变量名 → 值 的覆盖映射(整体替换并浅拷贝,不与调用方共享引用)
     */
    setCustom(custom: Record<string, string>): void {
      this.custom = { ...custom };
    },
    toggleTheme(): void {
      this.theme = this.theme === "light" ? "dark" : "light";
    },
  },
});
