/**
 * 微前端沙箱探测（按渲染拓扑分派，框架无关）。
 *
 * 拓扑三分：
 * - 同文档（无沙箱 / qiankun / micro-app light DOM / 降级 iframe）：absolute 正确
 * - 真 shadow DOM（web component 沙箱 / micro-app shadowDOM 模式）：absolute 正确，
 *   由组件的 `getRootNode() instanceof ShadowRoot` 检测命中
 * - graft 型（wujie）：iframe 文档树 graft 进 shadowRoot 渲染，absolute 输出视口系
 *   坐标但包含块是 graft body → 错位；fixed 以最近视口为包含块，是唯一正确解
 *
 * 安全性论证：非 graft 拓扑下 absolute 与 fixed 坐标等价（包含块同为最近视口），
 * iframe realm 下默认 fixed 零副作用；跨域 iframe 下 self/top 仅引用比较，
 * 不读属性，无 SecurityError。
 *
 * 已知边界：
 * - fixed 元素祖先有 transform/filter 时包含块被劫持（宿主布局应避免；graft 下
 *   absolute 的 offsetParent 解析本就失效，错法不同而非新增错误）
 * - fixed 面板在祖先滚动时依赖 autoUpdate 重算，重算前一帧有视口驻留（瞬时视觉差异）
 * - 若未来出现「非 iframe 的 graft 型沙箱」，本探测无法覆盖，需追加该沙箱的 marker 信号
 */

/** 组件 JS 是否运行在 iframe realm（wujie / iframe 型沙箱 / 普通 iframe 嵌入） */
export function isInIframeRealm(): boolean {
  return typeof window !== "undefined" && window.self !== window.top;
}

/** 是否处于 wujie graft 沙箱（getRootNode/父链被 wujie patch 伪装，结构探测失效，
 *  依赖官方标记；wujie 在子应用脚本执行前注入，时序可靠） */
export function isInWujie(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as { __POWERED_BY_WUJIE__?: boolean }).__POWERED_BY_WUJIE__ === true
  );
}
