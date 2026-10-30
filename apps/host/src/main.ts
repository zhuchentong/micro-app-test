import { createApp } from "vue";
import { createPinia } from "pinia";
import { bus } from "wujie";
import App from "./App.vue";
import { initWujie } from "./wujie";
import { useUserStore } from "@repo/store";
import "./style.css";

const pinia = createPinia();
// 演示用户:host 为状态权威源,初始数据从这里下发(经 props 与握手快照同步给子应用)
useUserStore(pinia).setUser({ id: "u1", name: "宿主张三" });
// 初始化 wujie(内部创建 host→子应用状态同步器),须在挂载前完成
initWujie(pinia, bus);
createApp(App).use(pinia).mount("#app");
