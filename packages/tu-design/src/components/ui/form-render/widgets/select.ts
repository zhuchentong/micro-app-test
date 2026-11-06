import { h } from "vue";
import { Select } from "../../../../components/ui/select";
import type { SelectWidgetOptions, WidgetRenderReturn } from "../types";
import { MODEL_VALUE, bindField } from "./bind";

/**
 * select widget：Select 已单组件化，items/placeholder 均为正式 prop 直写。
 * v3 命名穿透：options 整体透传给 Select（内部做 string 归一化）；
 * placeholder 解构出来做 item 级缺省回退（options 优先，I1 语义）。
 * @param options - widget 选项，items/placeholder 直写为组件 prop，其余整体透传给 Select
 * @returns 渲染函数，接收渲染上下文并产出 Select vnode
 */
export function renderSelectItem<T extends object>(
  options: SelectWidgetOptions,
): WidgetRenderReturn<T> {
  const { placeholder, items, ...rootProps } = options;
  return (ctx) =>
    h(Select, {
      ...rootProps,
      items,
      placeholder: placeholder ?? ctx.item.placeholder,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}
