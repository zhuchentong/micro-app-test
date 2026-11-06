/** virtual:micro-app-registry 类型声明(实现在 @repo/config-vite 的 microAppRegistryPlugin) */
declare module "virtual:micro-app-registry" {
  import type { MicroAppManifest } from "@repo/wujie-kit";

  /** 注册表条目:manifest 单源字段 + 从 vite.config.ts 字面量提取的端口 */
  export const microAppEntries: Array<MicroAppManifest & { port: number }>;
}
