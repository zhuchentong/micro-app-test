import { startApp, destroyApp } from "wujie";
import { useThemeStore } from "@repo/store";
import { authApp } from "./apps";
import { sharedDepsPlugins } from "./wujie";

/**
 * 登录态持久化键(单一来源):host 是登录态权威源,
 * main.ts 启动时读、App.vue 在 authLogin/logout 时写,共用此常量。
 * 放在本文件而非 main.ts:入口文件含顶层副作用(createApp.mount),不可被业务模块反向 import。
 */
export const AUTH_STORAGE_KEY = "wujie-mvp:auth:v1";

/** 网关实例幂等判据:与 wujie.ts 的 startedInstances 同一 token 模式(单实例,无需 Map) */
let gatewayToken: symbol | null = null;

/**
 * 拉起授权网关子应用。不走 Tab 系统:网关无菜单/Tab 语义,是登录前的全屏拦截层,
 * 由 App.vue 按 isAuthed 分流挂载到专用容器,登录成功即销毁(alive:false 重建模式)。
 * 幂等:判据存在(启动中/已启动)则跳过,重复调用不重复 startApp。
 * @param el 网关挂载容器(未登录视图的全屏 div)
 */
export function startAuthGateway(el: HTMLElement): void {
  if (gatewayToken) return; // 幂等:实例已在启动/运行中
  // 启动令牌:迟到的旧实例失败不得误清新实例的判据
  const token = Symbol(authApp.key);
  gatewayToken = token;
  startApp({
    name: authApp.key,
    url: authApp.domain,
    el,
    alive: false, // 重建模式:登录成功即销毁,下次未登录重新拉起
    sync: false, // 网关无路由语义,不同步查询参数
    plugins: sharedDepsPlugins, // 生产共享依赖注入,与 Tab 实例同源
    // HostProps 形状:网关启动时必未登录(登录后容器已被销毁),user 传空值占位
    props: { user: { id: "", name: "" }, theme: useThemeStore().theme },
  }).catch((error: unknown) => {
    // 仅释放本次启动的判据:迟到的旧实例失败不得误清新实例
    if (gatewayToken === token) gatewayToken = null;
    console.error("[auth] 授权网关加载失败", error);
  });
}

/**
 * 销毁授权网关实例(登录成功时调用)。幂等:无判据时直接返回。
 * @returns 销毁完成后 resolve(wujie destroyApp 为异步)
 */
export async function destroyAuthGateway(): Promise<void> {
  if (!gatewayToken) return;
  // 与 wujie.ts destroyInstance 同理由:wujie 的 sandbox.destroy() 在首个 await 之前
  // 就同步 deleteWujieById,先同步放开判据不会与在途 destroy 抢同一实例,
  // 销毁窗口内重新 start(登出→立即登录)也不会被旧判据挡住
  gatewayToken = null;
  try {
    await destroyApp(authApp.key);
  } catch (error) {
    console.error("[auth] 授权网关销毁失败:", error);
  }
}
