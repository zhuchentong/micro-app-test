import { createRouter, createWebHistory } from "vue-router";
import Home from "../pages/Home.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    {
      path: "/about",
      name: "about",
      component: () => import("../pages/About.vue"),
    },
  ],
});
