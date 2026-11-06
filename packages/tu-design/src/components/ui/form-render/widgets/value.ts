import { h } from "vue";
import { RadioGroup } from "../../../../components/ui/radio-group";
import { Slider } from "../../../../components/ui/slider";
import type { RadioGroupWidgetOptions, SliderWidgetOptions, WidgetRenderReturn } from "../types";
import { SLIDER, VALUE, bindField } from "./bind";

/**
 * radioGroup widget：单选组（值 prop 为 value）。
 * 命名穿透：选项字段为组件 required prop `items`，整体直传，widget 不做组装。
 * @param options - widget 选项，整体展开后经 value 受控绑定与 componentProps 透传给 RadioGroup
 * @returns 渲染函数，接收渲染上下文并产出 RadioGroup vnode
 */
export function renderRadioGroupItem<T extends object>(
  options: RadioGroupWidgetOptions,
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(RadioGroup, {
      ...options,
      ...bindField(ctx.field, VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * slider widget：number ↔ number[] 混合绑定特例
 * （值 prop 为 `value`，事件却是 `update:modelValue` 且数组语义，由 SLIDER spec 转换）。
 * @param options - widget 选项，整体展开后经 SLIDER 受控绑定与 componentProps 透传给 Slider
 * @returns 渲染函数，接收渲染上下文并产出 Slider vnode
 */
export function renderSliderItem<T extends object>(
  options: SliderWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(Slider, {
      ...options,
      ...bindField(ctx.field, SLIDER),
      ...ctx.item.componentProps,
    });
}
