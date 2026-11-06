import type { AnyFieldApi } from "@tanstack/vue-form";

/**
 * 值绑定形态描述：
 * - modelValue：大多数组件（Input/Password/Number/Currency/Textarea/picker 系/Select）
 * - checked：Checkbox/Switch
 * - value：RadioGroup
 * - SLIDER：Slider 特例 —— 值 prop 为 `value`，事件却是 `update:modelValue`，且数组语义（number ↔ [number]）
 */
export interface BindingSpec {
  prop: string;
  event: string;
  /** field 值 → 控件 prop 的转换（slider: number → [number]） */
  toProp?: (value: unknown) => unknown;
  /** 控件事件 → field 值的转换（slider: [number] → number） */
  fromEvent?: (value: unknown) => unknown;
}

export const MODEL_VALUE: BindingSpec = { prop: "modelValue", event: "modelValue" };
export const CHECKED: BindingSpec = { prop: "checked", event: "checked" };
export const VALUE: BindingSpec = { prop: "value", event: "value" };
export const SLIDER: BindingSpec = {
  prop: "value",
  event: "modelValue",
  toProp: (v) => (v === null || v === undefined ? undefined : [v]),
  fromEvent: (v) => (Array.isArray(v) ? (v[0] ?? null) : v),
};

/**
 * TanStack field → 控件 props 的统一绑定：
 * 值回显（field.state.value）+ 写回（handleChange）+ 失焦（handleBlur）。
 * @param field - TanStack 表单字段实例，提供值读取与变更/失焦句柄
 * @param spec - 绑定形态描述，决定值 prop 名、事件名与可选的双向转换
 * @returns 可展开到组件 props 上的对象（值 prop、onUpdate:<event>、onBlur）
 */
export function bindField(field: AnyFieldApi, spec: BindingSpec) {
  return {
    [spec.prop]: spec.toProp ? spec.toProp(field.state.value) : field.state.value,
    [`onUpdate:${spec.event}`]: (value: unknown) =>
      field.handleChange((spec.fromEvent ? spec.fromEvent(value) : value) as never),
    onBlur: field.handleBlur,
  };
}
