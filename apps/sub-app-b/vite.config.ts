import { musea } from "@vizejs/vite-plugin-musea";
import { defineConfig } from "@vizejs/vite-plugin/vite-plus";

export default defineConfig(
  {
    // wujie 通过 fetch 拉取子应用 HTML,cors 必须开启
    server: { port: 7202, host: true, cors: true },
    plugins: [musea({ include: ["**/*.art.vue"], basePath: "/__musea__" })],
  },
  { tasks: false },
);
