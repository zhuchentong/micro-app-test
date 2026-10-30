import { defineStore } from "pinia";

/** 共享主题 store:host 为权威源,子应用为副本(同一份定义,各自 pinia 实例化) */
export const useThemeStore = defineStore("theme", {
  state: () => ({ theme: "light" }),
  actions: {
    setTheme(theme: string): void {
      this.theme = theme;
    },
    toggleTheme(): void {
      this.theme = this.theme === "light" ? "dark" : "light";
    },
  },
});
