import { h } from "vue";
import { Input } from "../../../../components/ui/input";
import type { InputWidgetOptions, WidgetRenderReturn } from "../types";
import { MODEL_VALUE, bindField } from "./bind";

/**
 * input widget：单行文本输入（placeholder 为原生 attr 透传，aria-invalid 由 FormControl 接线）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给 Input
 * @returns 渲染函数，接收渲染上下文并产出 Input vnode
 */
export function renderInputItem<T extends object>(
  options: InputWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(Input, {
      placeholder: ctx.item.placeholder,
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}
