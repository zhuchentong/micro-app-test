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
    {
      path: "/products",
      name: "products",
      component: () => import("../pages/Products.vue"),
    },
    {
      path: "/product/:id",
      name: "product-detail",
      component: () => import("../pages/ProductDetail.vue"),
    },
  ],
});
