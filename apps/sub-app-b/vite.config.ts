import { defineAppConfig } from "@repo/config-vite";

export default defineAppConfig({
  // wujie 通过 fetch 拉取子应用 HTML,cors 必须开启
  // 端口必须写字面量:scripts/dev.mjs 与 stop.mjs 按正则提取 server.port
  server: { port: 7202, strictPort: true, host: true, cors: true },
});
