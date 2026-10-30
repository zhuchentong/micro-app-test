import { musea } from "@vizejs/vite-plugin-musea";
import { defineConfig } from "@vizejs/vite-plugin/vite-plus";

export default defineConfig(
  {
    // 5173 常被其他本地项目占用,固定 5175 保证入口 URL 稳定
    server: { port: 5175, strictPort: true },
    plugins: [musea({ include: ["**/*.art.vue"], basePath: "/__musea__" })],
  },
  { tasks: false },
);
