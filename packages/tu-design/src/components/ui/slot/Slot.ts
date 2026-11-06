import { Comment, createVNode, defineComponent, Fragment, h, Text } from "vue";
import type { VNode } from "vue";
import type { ClassValue } from "clsx";
import { cn } from "../../../lib/utils";

/**
 * 递归展平 `<slot />` 插槽出口（renderSlot）产生的 Fragment 包裹，取出真实子节点。
 * @param children - 插槽渲染输出的 vnode 数组
 * @returns 展平后的 vnode 数组（已剥离 Fragment 包裹层级）
 */
function flattenVNodes(children: VNode[]): VNode[] {
  const out: VNode[] = [];
  for (const child of children) {
    if (child.type === Fragment && Array.isArray(child.children)) {
      out.push(...flattenVNodes(child.children as VNode[]));
    } else {
      out.push(child);
    }
  }
  return out;
}

/**
 * asChild 组合原语：把落在自身上的 attrs（class、事件、透传属性）合并到默认插槽的
 * 第一个元素子节点上，而不是渲染额外 DOM。Button 的 asChild 与后续交互组件批次的
 * 组合能力都以此为基础。
 *
 * 合并语义（对齐 radix Slot）：
 * - 子元素自身标量 props 优先于注入的同名属性；
 * - class 经 cn 做 tailwind-merge 冲突合并（注入方的变体类可被子元素同类覆盖），
 *   且以 createVNode 重建子节点，避免 cloneVNode 拼接造成 class 重复；
 * - 事件处理器链式合并（子元素先触发，注入方后触发）；
 * - 子节点为文本/注释（如 v-if 为 false）时原样渲染，class 等注入丢弃；
 * - 默认插槽展平后为空时抛错。
 */
export const Slot = defineComponent({
  name: "Slot",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const children = flattenVNodes(slots.default?.() ?? []);
      if (children.length === 0) {
        throw new Error("Slot：需要一个默认插槽子节点");
      }
      const [first, ...rest] = children;
      if (first.type === Text || first.type === Comment) {
        return rest.length > 0 ? h(Fragment, children) : first;
      }

      const childProps = (first.props ?? {}) as Record<string, unknown>;
      const injected = attrs as Record<string, unknown>;
      // 以子元素自身 props 为起点重建，再按规则合入注入值：
      // 标量子元素优先、style 子元素优先（数组后者覆盖）、事件链式（子元素先触发）。
      const props: Record<string, unknown> = { ...childProps, key: first.key };
      for (const [key, value] of Object.entries(injected)) {
        if (key === "class") {
          continue;
        }
        if (key === "style") {
          props.style = props.style === undefined ? value : [value, props.style];
        } else if (key.startsWith("on")) {
          const prev = props[key];
          props[key] =
            prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
        } else if (!(key in props)) {
          props[key] = value;
        }
      }
      props.class = cn(injected.class as ClassValue, childProps.class as ClassValue);

      const target = createVNode(first.type, props, first.children);
      return rest.length > 0 ? h(Fragment, [target, ...rest]) : target;
    };
  },
});
