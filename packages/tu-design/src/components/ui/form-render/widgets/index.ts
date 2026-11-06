import type { WidgetRenders } from "../types";
import { renderCheckboxItem, renderSwitchItem } from "./boolean";
import {
  renderCurrencyItem,
  renderDatePickerItem,
  renderDateRangePickerItem,
  renderMonthPickerItem,
  renderNumberItem,
  renderPasswordItem,
  renderTextareaItem,
  renderYearPickerItem,
  renderWeekPickerItem,
} from "./model-value";
import { renderInputItem } from "./input";
import { renderSelectItem } from "./select";
import { renderRadioGroupItem, renderSliderItem } from "./value";
import { renderCascaderItem, renderTreeSelectItem } from "./tree";

/**
 * widget 注册表：`r.input({...})` 等柯里化工厂的运行时对象。
 * 文件按绑定形态聚合：input / model-value（modelValue 系）/ boolean（checked 系）/
 * value（radioGroup/slider）/ select（多子组件组装）。
 * @returns 各 widget 类型的柯里化工厂映射（render 为恒等直通），供 FormRender 渲染时调用
 */
export function widgetRenders<T extends object>(): WidgetRenders<T> {
  return {
    input: renderInputItem<T>,
    password: renderPasswordItem<T>,
    number: renderNumberItem<T>,
    currency: renderCurrencyItem<T>,
    textarea: renderTextareaItem<T>,
    select: renderSelectItem<T>,
    checkbox: renderCheckboxItem<T>,
    switch: renderSwitchItem<T>,
    radioGroup: renderRadioGroupItem<T>,
    treeSelect: renderTreeSelectItem<T>,
    cascader: renderCascaderItem<T>,
    slider: renderSliderItem<T>,
    datePicker: renderDatePickerItem<T>,
    monthPicker: renderMonthPickerItem<T>,
    yearPicker: renderYearPickerItem<T>,
    dateRangePicker: renderDateRangePickerItem<T>,
    weekPicker: renderWeekPickerItem<T>,
    render: (fn) => fn,
  };
}
