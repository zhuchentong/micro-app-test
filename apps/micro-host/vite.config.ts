import { defineAppConfig, microAppRegistryPlugin } from "@repo/config-vite";

export default defineAppConfig({
  // 5173 常被其他本地项目占用,固定 5175 保证入口 URL 稳定
  // 端口必须写字面量:scripts/dev.mjs 与 stop.mjs 按正则提取 server.port
  server: { port: 5175, strictPort: true },
  // 子应用注册聚合:apps/<name>/app.manifest.json + 各 vite.config.ts 端口字面量
  // → virtual:micro-app-registry(src/apps.ts 消费;新增子应用零登记)
  plugins: [microAppRegistryPlugin()],
});
