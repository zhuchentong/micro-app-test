import { computed, useId } from "vue";

/** 与 zag ids 兼容的宽类型：string 或函数型（如 select 的 item(value) => string） */
export type OverlayIds = Record<string, string | ((value: string) => string)>;

/**
 * 浮层组件 ids 全量覆盖（无冒号化）。
 *
 * 背景：zag 缺省 id 惯例形如 `popover:{scope.id}:title`（各包 *.dom.js get*Id
 * 兜底分支），而部分 part 元素并不总是渲染（title/description/anchor/clearTrigger/
 * arrow 等），machine 仍会按状态变更反复 getById 查询。wujie 沙箱把
 * document.getElementById patch 成 `querySelector('[id="…"]')` miss 后兜底
 * `querySelector('#'+id)`（wujie proxy.js），冒号未转义 → SyntaxError → catch 打出
 * "[wujie warn] 不支持document.getElementById()传入特殊字符…" 且打开期间反复刷屏。
 * ids 派生自 Vue useId()（v-0 格式，无冒号）后，未命中也是合法选择器，静默返回
 * null，告警消除；原生环境 getElementById 不解析选择器，行为零变化。
 *
 * 用法（组件 setup 内，inheritAttrs: false 透传模式下同样适用）：
 *   const { ids, resolveId } = useOverlayIds(attrs, {
 *     primary: "content",
 *     parts: ["title", "description", "anchor", "trigger", "closeTrigger", "positioner", "arrow"],
 *   });
 *   // 模板：<ArkXxx.Root v-bind="attrs" :ids="ids">（:ids 须位于 v-bind="attrs" 之后）
 *   // aria 手动接线取元素 id 时用 resolveId(part)（user 覆盖优先，与实际 DOM 一致）
 *
 * 边界：parts 只声明「字符串型覆盖口」的 part；函数型 part（如 select 的
 * item/itemGroup/itemGroupLabel——元素必渲染，[id="…"] 首查即命中，无炸点）不进
 * parts，由 user 经 attrs.ids 直传原样保留。user 永远最后展开：显式传入以其为准。
 * @param attrs - 组件透传 attrs（其中的 ids 为用户覆盖项，可为 undefined）
 * @param options - 生成配置：primary 为主 part（stemId 不加后缀），parts 为声明覆盖口的 part 列表
 * @returns ids（合并用户覆盖后的完整 id 映射，供 :ids 受控绑定）与 resolveId（取实际生效的字符串 id，供 aria 手动接线）
 */
export function useOverlayIds(
  attrs: Record<string, unknown>,
  options: { primary: string; parts: readonly string[] },
) {
  const stemId = useId();
  const userIds = computed(() => (attrs.ids ?? {}) as OverlayIds);
  /**
   * 默认派生值（不含 user 覆盖），独立于 ids 供 resolveId 回退；构造恒为字符串。
   * @returns 以 part 为键的默认 id 映射
   */
  const buildBase = (): Record<string, string> => {
    const base: Record<string, string> = {};
    for (const part of options.parts) {
      base[part] = part === options.primary ? stemId : `${stemId}-${part}`;
    }
    return base;
  };
  const ids = computed<OverlayIds>(() => ({ ...buildBase(), ...userIds.value })); // user 永远收尾
  /**
   * aria 接线用：user 字符串覆盖优先，函数型 user 回退默认值。
   * @param part - 目标 part 名（如 "title"、"trigger"）
   * @returns 该 part 实际生效的字符串 id；part 未声明覆盖口时返回 undefined
   */
  const resolveId = (part: string) => {
    const v = userIds.value[part];
    return typeof v === "string" ? v : buildBase()[part];
  };
  return { ids, resolveId };
}
