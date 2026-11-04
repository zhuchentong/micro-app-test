import { defineAppConfig } from "@repo/config-vite";
import VueRouter from "vue-router/vite";

export default defineAppConfig({
  // wujie 通过 fetch 拉取子应用 HTML,cors 必须开启
  // 端口必须写字面量:scripts/dev.mjs 与 stop.mjs 按正则提取 server.port
  server: { port: 7202, strictPort: true, host: true, cors: true },
  // vue-router 5 内置文件路由:约定式扫描 src/pages,dts 生成物入 gitignored 目录
  plugins: [VueRouter({ dts: "src/types/generated/route-map.d.ts" })],
});
