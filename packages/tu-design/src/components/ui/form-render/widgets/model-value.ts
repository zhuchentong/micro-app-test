import type { Component } from "vue";
import { h } from "vue";
import { CurrencyInput } from "../../../../components/ui/currency-input";
import { DatePicker } from "../../../../components/ui/date-picker";
import { DateRangePicker } from "../../../../components/ui/date-range-picker";
import { MonthPicker } from "../../../../components/ui/month-picker";
import { NumberInput } from "../../../../components/ui/number-input";
import { PasswordInput } from "../../../../components/ui/password-input";
import { Textarea } from "../../../../components/ui/textarea";
import { WeekPicker } from "../../../../components/ui/week-picker";
import { YearPicker } from "../../../../components/ui/year-picker";
import type {
  CurrencyWidgetOptions,
  DatePickerWidgetOptions,
  DateRangeWidgetOptions,
  MonthPickerWidgetOptions,
  NumberWidgetOptions,
  PasswordWidgetOptions,
  TextareaWidgetOptions,
  WeekPickerWidgetOptions,
  WidgetRenderReturn,
  YearPickerWidgetOptions,
} from "../types";
import { MODEL_VALUE, bindField } from "./bind";

/**
 * modelValue 形态 widgets 统一展开模式（方案 C）：
 * item 级缺省 → options 整体展开（命名穿透，组件全 props）→ 受控绑定 → 逃逸口。
 * options.placeholder 为 undefined 时 Vue 视为未传，item 级缺省保留（I1 语义）。
 */

/**
 * password widget：密码输入（autoComplete 为组件真实 prop，直接派生透传）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给 PasswordInput
 * @returns 渲染函数，接收渲染上下文并产出 PasswordInput vnode
 */
export function renderPasswordItem<T extends object>(
  options: PasswordWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(PasswordInput, {
      placeholder: ctx.item.placeholder,
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * number widget：数值输入（modelValue: number|null）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给 NumberInput
 * @returns 渲染函数，接收渲染上下文并产出 NumberInput vnode
 */
export function renderNumberItem<T extends object>(
  options: NumberWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(NumberInput, {
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * currency widget：金额输入（labelUnit/valueUnit 单位展示）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给 CurrencyInput
 * @returns 渲染函数，接收渲染上下文并产出 CurrencyInput vnode
 */
export function renderCurrencyItem<T extends object>(
  options: CurrencyWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(CurrencyInput, {
      placeholder: ctx.item.placeholder,
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * textarea widget：多行文本（placeholder/rows 为原生 attr 透传）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给 Textarea
 * @returns 渲染函数，接收渲染上下文并产出 Textarea vnode
 */
export function renderTextareaItem<T extends object>(
  options: TextareaWidgetOptions = {},
): WidgetRenderReturn<T> {
  return (ctx) =>
    h(Textarea, {
      placeholder: ctx.item.placeholder,
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * 日期类 widget 共用工厂：入口各自携带强类型（DatePicker/Month/Year/DateRange 的
 * props 面互不相同，见 types.ts 各派生接口），内部共享实现无需重复泛型关联。
 * @param component - 日期类组件（DatePicker/MonthPicker/YearPicker/DateRangePicker/WeekPicker）
 * @param options - widget 选项，整体展开后经 modelValue 受控绑定与 componentProps 透传给组件
 * @returns 渲染函数，接收渲染上下文并产出对应日期组件的 vnode
 */
function pickerRenderer(component: Component, options: object): WidgetRenderReturn<any> {
  return (ctx) =>
    h(component, {
      placeholder: ctx.item.placeholder,
      ...options,
      ...bindField(ctx.field, MODEL_VALUE),
      ...ctx.item.componentProps,
    });
}

/**
 * datePicker widget：日期选择（单日，modelValue 受控形态）
 * @param options - widget 选项，经 pickerRenderer 共享实现透传给 DatePicker
 * @returns 渲染函数，接收渲染上下文并产出 DatePicker vnode
 */
export function renderDatePickerItem<T extends object>(
  options: DatePickerWidgetOptions = {},
): WidgetRenderReturn<T> {
  return pickerRenderer(DatePicker, options);
}

/**
 * monthPicker widget：月份选择（modelValue 受控形态）
 * @param options - widget 选项，经 pickerRenderer 共享实现透传给 MonthPicker
 * @returns 渲染函数，接收渲染上下文并产出 MonthPicker vnode
 */
export function renderMonthPickerItem<T extends object>(
  options: MonthPickerWidgetOptions = {},
): WidgetRenderReturn<T> {
  return pickerRenderer(MonthPicker, options);
}

/**
 * yearPicker widget：年份选择（modelValue 受控形态）
 * @param options - widget 选项，经 pickerRenderer 共享实现透传给 YearPicker
 * @returns 渲染函数，接收渲染上下文并产出 YearPicker vnode
 */
export function renderYearPickerItem<T extends object>(
  options: YearPickerWidgetOptions = {},
): WidgetRenderReturn<T> {
  return pickerRenderer(YearPicker, options);
}

/**
 * dateRangePicker widget：[start, end] | null 形态
 * @param options - widget 选项，经 pickerRenderer 共享实现透传给 DateRangePicker
 * @returns 渲染函数，接收渲染上下文并产出 DateRangePicker vnode
 */
export function renderDateRangePickerItem<T extends object>(
  options: DateRangeWidgetOptions = {},
): WidgetRenderReturn<T> {
  return pickerRenderer(DateRangePicker, options);
}

/**
 * weekPicker widget：周选择（modelValue 受控形态）
 * @param options - widget 选项，经 pickerRenderer 共享实现透传给 WeekPicker
 * @returns 渲染函数，接收渲染上下文并产出 WeekPicker vnode
 */
export function renderWeekPickerItem<T extends object>(
  options: WeekPickerWidgetOptions = {},
): WidgetRenderReturn<T> {
  return pickerRenderer(WeekPicker, options);
}
