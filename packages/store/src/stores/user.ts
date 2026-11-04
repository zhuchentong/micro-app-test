import { defineStore } from "pinia";

/** 共享用户信息 store:同 theme,host 权威、子应用副本 */
export const useUserStore = defineStore("user", {
  state: () => ({ user: { id: "", name: "" } }),
  getters: {
    /**
     * 登录态判定:id 非空即视为已登录(host 分流与子应用界面共用同一判据)
     * @param state store 当前状态
     * @returns 用户是否已登录
     */
    isLoggedIn: (state): boolean => state.user.id !== "",
  },
  actions: {
    setUser(user: { id: string; name: string }): void {
      this.user = user;
    },
    /** 清除登录态(登出;未登录时幂等) */
    clearUser(): void {
      this.user = { id: "", name: "" };
    },
  },
});
