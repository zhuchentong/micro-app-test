import type { ComponentPublicInstance } from "vue";
import { h } from "vue";
import { Cascader } from "../../../../components/ui/cascader";
import { TreeSelect } from "../../../../components/ui/tree-select";
import type { CascaderWidgetOptions, TreeSelectWidgetOptions, WidgetRenderReturn } from "../types";
import { MODEL_VALUE, bindField } from "./bind";

/**
 * treeSelect / cascader widget：树形选项族（modelValue 受控形态）。
 * 命名穿透：options 原名直传（TreeOption：key/label/children/disabled）；
 * placeholder 先用 item 级回退（I1），options.placeholder 展开时覆盖。
 *
 * 断言说明：两组件的 boolean props（multiple/checkable/clearable…）为裸
 * `Boolean, default: false` 声明，vue-tsc ExtractPropTypes 将其推断为 required，
 * spread Partial 必缺键；断言到 $props 同源类型保留键名检查（优于 as never）。
 */
type SfcAllProps<C> = C extends abstract new (...args: never[]) => any
  ? Partial<ComponentPublicInstance["$props"]> & InstanceType<C>["$props"]
  : never;

/**
 * treeSelect widget：树形下拉选择，options 原名直传（TreeOption 命名穿透），
 * placeholder 先用 item 级回退（I1），options.placeholder 展开时覆盖。
 * @param options - widget 选项，原名直传给 TreeSelect，placeholder 以 item 级缺省兜底
 * @returns 渲染函数，接收渲染上下文并产出 TreeSelect vnode
 */
export function renderTreeSelectItem<T extends object>(
  options: TreeSelectWidgetOptions,
): WidgetRenderReturn<T> {
  const { placeholder, ...rest } = options;
  return (ctx) =>
    h(TreeSelect, {
      placeholder: placeholder ?? ctx.item.placeholder,
      ...rest,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    } as SfcAllProps<typeof TreeSelect>);
}

/**
 * cascader widget：级联选择，绑定与 treeSelect 一致（modelValue 受控形态），
 * placeholder 先用 item 级回退（I1），options.placeholder 展开时覆盖。
 * @param options - widget 选项，原名直传给 Cascader，placeholder 以 item 级缺省兜底
 * @returns 渲染函数，接收渲染上下文并产出 Cascader vnode
 */
export function renderCascaderItem<T extends object>(
  options: CascaderWidgetOptions,
): WidgetRenderReturn<T> {
  const { placeholder, ...rest } = options;
  return (ctx) =>
    h(Cascader, {
      placeholder: placeholder ?? ctx.item.placeholder,
      ...rest,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    } as SfcAllProps<typeof Cascader>);
}
