import { useFormRender, type UseFormRenderOptions } from "./useFormRender";
import type { FormRenderDefinition, FormRenderItem } from "./types";

export interface DefineFormOptions<T extends object> {
  items: FormRenderItem<T>[];
  /** Standard Schema（valibot v.object 输出直接兼容），映射到 TanStack validators.onSubmit */
  schema?: unknown;
  onSubmit?: (ctx: { value: T }) => void | Promise<void>;
  /** 按钮预设七项（A1 块级互斥）：显式传任一项即投影为 definition.actions，组件按钮 props 全量忽略 */
  searchable?: boolean;
  submitable?: boolean;
  resetable?: boolean;
  cancelable?: boolean;
  searchText?: string;
  submitText?: string;
  resetText?: string;
  /** 其余 TanStack useForm 选项透传（如 onSubmitInvalid） */
  formOptions?: Record<string, unknown>;
}

/**
 * 聚合入口：单次调用完成「字段定义 + 类型约束 + 表单实例 + 按钮预设」。
 *
 * 返回 `{ items, form, resetToDefaults, submit, actions? }`：
 * - `items` / `form` 传给 `<FormRender>`（支持 `:definition` 单 prop 或 `:form` + `:items` 拆分）；
 * - `form` 可直接 `reset()` / `validate()` / `handleSubmit()`；
 * - `resetToDefaults()` 重置到 `items.default`（搜索表单"重置"语义）；
 * - `submit()` 全量校验并返回是否通过（R30，组合式查询链路）；
 * - `actions` 按钮预设（searchable 等七项直传）：存在时 `<FormRender>` 组件按钮 props 全量忽略（A1 块级互斥）。
 *
 * 须在组件 setup 中调用（TanStack useForm 约束）。
 * @param config - 表单配置：字段定义、校验 schema、提交回调、按钮预设七项与 TanStack 透传项
 * @returns 表单渲染 definition（items + form + resetToDefaults + submit + actions?），直接传给 <FormRender>
 */
export function defineForm<T extends object>(
  config: DefineFormOptions<T>,
): FormRenderDefinition<T> {
  return useFormRender<T>(config satisfies UseFormRenderOptions<T>);
}
