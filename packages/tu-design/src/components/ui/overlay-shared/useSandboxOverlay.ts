import type { ComputedRef } from "vue";
import { computed, getCurrentInstance, onMounted, ref } from "vue";
import { isInIframeRealm, isInWujie } from "./sandbox";

/**
 * 浮层沙箱适配公共层（Popover 0.5.3 修复的推广形态，机制与实测依据见 sandbox.ts 头注）：
 * - useSandboxTeleportTarget：Teleport 目标降级（真 shadow DOM / wujie graft → 应用挂载容器）
 * - withSandboxStrategy：iframe realm 下 positioning.strategy 默认 fixed（absolute 包含块错位修正）
 */

/**
 * 浮层 Teleport 目标解析：显式 to > shadow DOM / wujie graft 自动降级 > body。
 *
 * app._container 在 mount 的 render 完成后才赋值（runtime-core 3.5.43：render L4337
 * → 赋值 L4340），而子组件 onMounted 在 render 内同步执行、届时仍为 undefined，
 * 故检测再延后一个微任务（mount 调用栈结束后 _container 必已赋值），结果存 ref
 * 驱动 computed 重算；getCurrentInstance 仅 setup 同步上下文可用，本函数须在
 * setup 顶层调用。共享 Vue（__MICRO_SHARED__）下各子应用 app._container 相互
 * 独立，检测按实例隔离。
 * 沙箱两类：真 shadow DOM 由 getRootNode() 命中；wujie graft 下 getRootNode/父链
 * 被 patch 伪装成 iframe 文档语义（实测），结构探测失效，须叠加官方标记位。
 * 其余微前端（qiankun / micro-app light DOM）body 即主文档 body，兜底正确。
 *
 * @param explicitTo 组件显式 to 的取值函数（响应式安全：computed 内重读）
 * @returns Teleport 目标（显式 to 优先，其次降级容器，兜底 body）
 */
export function useSandboxTeleportTarget(
  explicitTo: () => string | HTMLElement | undefined,
): ComputedRef<string | HTMLElement> {
  const instance = getCurrentInstance();
  const inWujie = isInWujie();
  const detectedTarget = ref<string | HTMLElement>("body");
  onMounted(() => {
    queueMicrotask(() => {
      if (explicitTo()) return;
      const container = (instance?.appContext.app as { _container?: HTMLElement } | undefined)
        ?._container;
      if (container && (container.getRootNode() instanceof ShadowRoot || inWujie)) {
        detectedTarget.value = container;
      }
    });
  });
  return computed(() => explicitTo() ?? detectedTarget.value);
}

/**
 * iframe realm（wujie graft / iframe 型沙箱 / iframe 嵌入）且用户未显式指定
 * strategy 时默认 fixed：非 graft 拓扑下 fixed 与 absolute 坐标等价（零副作用），
 * graft 拓扑（wujie）absolute 包含块错位，fixed 是唯一正确解。
 * 纯函数、原地写入 merged（调用方传入自己的合成对象，无共享引用风险）；
 * user.strategy 显式给出（含 null 意义上的「未传」判定用 == null）时以其为准。
 *
 * @param user 用户原始 positioning（undefined 或经 attrs 透传的合成对象）
 * @param merged 组件已合成 placement/sameWidth 等的基础 positioning（将被写入）
 * @returns 写入 strategy 后的 merged（同引用，便于 computed 直接 return）
 */
export function withSandboxStrategy<T extends object>(user: T | undefined, merged: T): T {
  if (isInIframeRealm() && (user as { strategy?: string } | undefined)?.strategy == null) {
    (merged as { strategy?: string }).strategy = "fixed";
  }
  return merged;
}
