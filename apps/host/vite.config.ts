import { defineAppConfig } from "@repo/vite";

export default defineAppConfig({
  // 5173 常被其他本地项目占用,固定 5175 保证入口 URL 稳定
  // 端口必须写字面量:scripts/dev.mjs 与 stop.mjs 按正则提取 server.port
  server: { port: 5175, strictPort: true },
});
