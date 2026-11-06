import type { App as VueApp } from "vue";
import type { Pinia } from "pinia";
import { createPinia } from "pinia";
import { createSubStoreSync } from "@repo/store/sub";

/**
 * pinia 与 store 同步组合根:每次挂载创建新实例,兼容保活(只注册一次)与非保活(remount 重建)。
 * @param app 目标 Vue 应用
 * @returns pinia 实例(供后续 setup 显式传参,不依赖活跃实例时序)
 */
export function piniaSetup(app: VueApp): Pinia {
  const pinia = createPinia();
  app.use(pinia);

  const storeSync = createSubStoreSync({ pinia });
  storeSync.register();
  app.onUnmount(() => storeSync.dispose());

  return pinia;
}
