import { h } from "vue";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Switch } from "../../../../components/ui/switch";
import type { CheckboxWidgetOptions, SwitchWidgetOptions, WidgetRenderReturn } from "../types";
import { CHECKED, bindField } from "./bind";

/**
 * checkbox/switch widget：boolean 形态（值 prop 为 checked，非 modelValue）。
 * 单行布局倾向 hideLabel + label 经 item.title 展示由使用者决定。
 * @param options - widget 选项，整体展开后经 checked 受控绑定与 componentProps 透传给 Checkbox
 * @returns 渲染函数，接收渲染上下文并产出 Checkbox vnode
 */
export function renderCheckboxItem<T extends object>(
  options: CheckboxWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(Checkbox, {
      ...options,
      ...bindField(ctx.field, CHECKED),
      ...ctx.item.componentProps,
    });
}

/**
 * switch widget：boolean 开关（checked 受控形态，绑定与 checkbox 一致）
 * @param options - widget 选项，整体展开后经 checked 受控绑定与 componentProps 透传给 Switch
 * @returns 渲染函数，接收渲染上下文并产出 Switch vnode
 */
export function renderSwitchItem<T extends object>(
  options: SwitchWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(Switch, {
      ...options,
      ...bindField(ctx.field, CHECKED),
      ...ctx.item.componentProps,
    });
}
