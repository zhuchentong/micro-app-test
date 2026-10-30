import { defineStore } from "pinia";

/** 共享用户信息 store:同 theme,host 权威、子应用副本 */
export const useUserStore = defineStore("user", {
  state: () => ({ user: { id: "", name: "" } }),
  actions: {
    setUser(user: { id: string; name: string }): void {
      this.user = user;
    },
  },
});
