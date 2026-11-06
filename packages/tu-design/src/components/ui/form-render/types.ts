import type { AnyFieldApi, FormApi, VueFormApi } from "@tanstack/vue-form";
import type { VNode } from "vue";
import type { Checkbox } from "../../../components/ui/checkbox";
import type { CurrencyInput } from "../../../components/ui/currency-input";
import type { DatePicker } from "../../../components/ui/date-picker";
import type { DateRangePicker } from "../../../components/ui/date-range-picker";
import type { Input } from "../../../components/ui/input";
import type { MonthPicker } from "../../../components/ui/month-picker";
import type { WeekPicker } from "../../../components/ui/week-picker";
import type { NumberInput } from "../../../components/ui/number-input";
import type { PasswordInput } from "../../../components/ui/password-input";
import type { RadioGroup } from "../../../components/ui/radio-group";
import type { Cascader } from "../../../components/ui/cascader";
import type { TreeSelect } from "../../../components/ui/tree-select";
import type { Select } from "../../../components/ui/select";
import type { Slider } from "../../../components/ui/slider";
import type { Switch } from "../../../components/ui/switch";
import type { Textarea } from "../../../components/ui/textarea";
import type { YearPicker } from "../../../components/ui/year-picker";
import type { SelectItemOption } from "../../../components/ui/select";

/**
 * useForm() 返回实例的宽松形态（与 form/context.ts 的 FormInstance 同款契约：
 * provide/inject 与跨组件边界会擦除泛型，any 化是项目既定约定）。
 */
/* prettier-ignore */
export type FormRenderFormApi =
  FormApi<any, any, any, any, any, any, any, any, any, any, any, any> &
  VueFormApi<any, any, any, any, any, any, any, any, any, any, any, any>;

/** 字段渲染上下文（widget 柯里化第二段的唯一参数） */
export interface WidgetContext<T extends object> {
  field: AnyFieldApi;
  item: FormRenderItem<T>;
  /** 当前全量表单值（响应式，来自 form.useSelector(s => s.values)；联动用） */
  values: T;
}

export type WidgetRenderReturn<T extends object> = (ctx: WidgetContext<T>) => VNode;

/** select/radioGroup 等选项的通用形态（字符串简写或 { label, value }） */
export type WidgetItemOption = string | SelectItemOption;

/**
 * SFC props 类型派生（方案 C）：widget 参数 = 原组件全部 props（命名穿透，
 * prop 变更时类型自动同步）。受控字段由 bindField/FormControl/items.default
 * 接管，用户不可传；Omit 不存在的键是 no-op，统一集合即可。
 */
type ControlledKey =
  | "modelValue"
  | "onUpdate:modelValue"
  | "checked"
  | "onUpdate:checked"
  | "value"
  | "onUpdate:value"
  | "onBlur"
  | "invalid"
  | "class"
  | "id"
  | "defaultValue"
  | "defaultChecked";

export type SfcOptions<T extends abstract new (...args: any) => any> = Partial<
  Omit<InstanceType<T>["$props"], ControlledKey>
>;

// —— 各 widget 选项：组件全 props 派生（命名穿透） ——

export type NumberWidgetOptions = SfcOptions<typeof NumberInput>;

export type CurrencyWidgetOptions = SfcOptions<typeof CurrencyInput>;

/** autoComplete 为 PasswordInput 真实 prop（探针实证），直接派生获得 */
export type PasswordWidgetOptions = SfcOptions<typeof PasswordInput>;

/** Input 自身无 placeholder/type prop（原生 attr 透传），交叉手写 */
export type InputWidgetOptions = SfcOptions<typeof Input> & {
  placeholder?: string;
  type?: string;
};

/** Textarea 自身无 placeholder/rows prop（原生 attr 透传），交叉手写 */
export type TextareaWidgetOptions = SfcOptions<typeof Textarea> & {
  placeholder?: string;
  rows?: number;
};

/**
 * v3 命名穿透：选项字段即组件 prop 名 `items`——显式必填（Partial 化会退化为可选，
 * 缺失时 Select.vue collection 计算在首渲染崩溃）；placeholder 已是 Select 单组件
 * 的正式 prop，不再 Omit，渲染时做 item 级缺省回退（I1）。
 */
export type SelectWidgetOptions = Omit<SfcOptions<typeof Select>, "items"> & {
  items: WidgetItemOption[];
};

export type CheckboxWidgetOptions = SfcOptions<typeof Checkbox>;

export type SwitchWidgetOptions = SfcOptions<typeof Switch>;

/**
 * radioGroup widget：单选组（值 prop 为 value）。items 为组件 required prop，
 * 显式必填（Partial 化会退化为可选）；选项字段与组件 prop 同名（命名穿透）。
 * 注意：RadioGroup 不支持 Select 的字符串简写（无 normalize 回退，直传即崩），
 * 此处收窄为 SelectItemOption[] 而非 WidgetItemOption[]。
 */
export type RadioGroupWidgetOptions = Omit<SfcOptions<typeof RadioGroup>, "items"> & {
  items: SelectItemOption[];
};

/** TreeSelect / Cascader：选项 prop 原名 options，受控走 modelValue（ControlledKey 自动剔除） */
export type TreeSelectWidgetOptions = SfcOptions<typeof TreeSelect>;

export type CascaderWidgetOptions = SfcOptions<typeof Cascader>;

export type SliderWidgetOptions = SfcOptions<typeof Slider>;

/** picker 三组件 props 面不同（DatePicker 有 isDateUnavailable/max/min，Month/Year 有 locale），各自派生 */
export type DatePickerWidgetOptions = SfcOptions<typeof DatePicker>;

export type MonthPickerWidgetOptions = SfcOptions<typeof MonthPicker>;

export type YearPickerWidgetOptions = SfcOptions<typeof YearPicker>;

export type DateRangeWidgetOptions = SfcOptions<typeof DateRangePicker>;

export type WeekPickerWidgetOptions = SfcOptions<typeof WeekPicker>;

/**
 * widget 注册表类型契约：实现对象在 widgets/index.ts。
 * 类型集中于此避免循环依赖（type-only import 无运行时环）。
 */
export interface WidgetRenders<T extends object> {
  input(o?: InputWidgetOptions): WidgetRenderReturn<T>;
  password(o?: PasswordWidgetOptions): WidgetRenderReturn<T>;
  number(o?: NumberWidgetOptions): WidgetRenderReturn<T>;
  currency(o?: CurrencyWidgetOptions): WidgetRenderReturn<T>;
  textarea(o?: TextareaWidgetOptions): WidgetRenderReturn<T>;
  select(o: SelectWidgetOptions): WidgetRenderReturn<T>;
  checkbox(o?: CheckboxWidgetOptions): WidgetRenderReturn<T>;
  switch(o?: SwitchWidgetOptions): WidgetRenderReturn<T>;
  radioGroup(o: RadioGroupWidgetOptions): WidgetRenderReturn<T>;
  treeSelect(o: TreeSelectWidgetOptions): WidgetRenderReturn<T>;
  cascader(o: CascaderWidgetOptions): WidgetRenderReturn<T>;
  slider(o?: SliderWidgetOptions): WidgetRenderReturn<T>;
  datePicker(o?: DatePickerWidgetOptions): WidgetRenderReturn<T>;
  monthPicker(o?: MonthPickerWidgetOptions): WidgetRenderReturn<T>;
  yearPicker(o?: YearPickerWidgetOptions): WidgetRenderReturn<T>;
  dateRangePicker(o?: DateRangeWidgetOptions): WidgetRenderReturn<T>;
  weekPicker(o?: WeekPickerWidgetOptions): WidgetRenderReturn<T>;
  /** 逃逸口：完全自定义渲染 */
  render(fn: (ctx: WidgetContext<T>) => VNode): WidgetRenderReturn<T>;
}

export interface FormRenderItem<T extends object> {
  /**
   * 字段名：严格 keyof T —— 自动补全 + 拼错编译报错。
   * 额外字段请在 T 中显式声明；运行时以 String(key) 归一为 FormField 的 name。
   */
  key: keyof T;
  title: string;
  description?: string;
  placeholder?: string;
  /**
   * 默认值（值或同步工厂）；defineForm 据此派生 defaultValues。
   * 类型为 T 值域联合 T[keyof T]（无 per-item 精确联动，强于 x-render 的 any）。
   */
  default?: T[keyof T] | (() => T[keyof T]);
  /** 栅格跨度：数字 = 占 n 列（须 ≤ 实际列数）；"full" = 整行 */
  span?: number | "full";
  /** 联动显隐；消费 FormRender 经 useSelector 建立的响应式 values */
  visible?: boolean | ((values: T) => boolean);
  hideLabel?: boolean;
  class?: string;
  /** TanStack 字段级校验器透传（如 onChangeAsync） */
  validators?: Record<string, unknown>;
  /** widget 描述；缺省 = r.input() */
  render?: (r: WidgetRenders<T>) => WidgetRenderReturn<T>;
  /** 逃逸口：原样合并到控件 vnode 的 props */
  componentProps?: Record<string, unknown>;
}

/** 按钮预设（A1 块级互斥：actions 存在时 <FormRender> 组件按钮 props 全量忽略） */
export interface FormActionsConfig {
  /** 搜索按钮，缺省 false */
  searchable?: boolean;
  /** 提交按钮，缺省 false */
  submitable?: boolean;
  /** 重置按钮；缺省跟随 searchable（A2，域内解析） */
  resetable?: boolean;
  /** 取消按钮；缺省跟随 submitable（A2，域内解析） */
  cancelable?: boolean;
  searchText?: string;
  submitText?: string;
  resetText?: string;
}

export interface FormRenderDefinition<T extends object> {
  items: FormRenderItem<T>[];
  form: FormRenderFormApi;
  /** 重置到 items.default（搜索表单"重置"语义） */
  resetToDefaults: () => void;
  /** 全量校验并返回是否通过（R30）；不触发 FormRender 的 search/submit 事件。
   * 组合式外部查询标准链路：`if (await table.search.submit()) table.reload(true)` */
  submit: () => Promise<boolean>;
  /** 按钮预设投影（引擎从 options 七项直传；未配置为 undefined——此时组件按钮 props 全量生效） */
  actions?: FormActionsConfig;
}
