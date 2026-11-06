import { useForm } from "@tanstack/vue-form";
import type { FormRenderDefinition, FormRenderItem } from "./types";

export interface UseFormRenderOptions<T extends object> {
  items: FormRenderItem<T>[];
  /** Standard Schema（valibot v.object 输出直接兼容），映射到 TanStack validators.onSubmit */
  schema?: unknown;
  onSubmit?: (ctx: { value: T }) => void | Promise<void>;
  /** 按钮预设七项（A1）：显式传任一项即投影为 actions（definition 域，组件按钮 props 全量忽略） */
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
 * 底层原语：包装 TanStack useForm（聚合入口 defineForm 内部也走这里）。
 *
 * - `defaultValues` 从 `items[].default` 派生（值或同步工厂，缺省 null）——单一真相源；
 * - 显式泛型 `useForm<T>`，保住 onSubmit `{ value: T }` 全链路推断；
 * - 须在组件 setup 中调用（TanStack useForm 内部 `onMounted(formApi.mount)`）。
 * @param options - 表单选项：字段定义、校验 schema、提交回调、按钮预设七项与 TanStack 透传项
 * @returns 表单渲染 definition（items + form + resetToDefaults + submit + actions?）
 */
export function useFormRender<T extends object>(
  options: UseFormRenderOptions<T>,
): FormRenderDefinition<T> {
  const {
    items,
    schema,
    onSubmit,
    formOptions,
    searchable,
    submitable,
    resetable,
    cancelable,
    searchText,
    submitText,
    resetText,
  } = options;

  // 按钮预设七项直传投影（A1 块级互斥的 definition 域；全 undefined = 未配置 → 组件 props 域生效）
  const actions =
    searchable === undefined &&
    submitable === undefined &&
    resetable === undefined &&
    cancelable === undefined &&
    searchText === undefined &&
    submitText === undefined &&
    resetText === undefined
      ? undefined
      : { searchable, submitable, resetable, cancelable, searchText, submitText, resetText };

  const defaultValues = Object.fromEntries(
    items.map((item) => [
      String(item.key),
      typeof item.default === "function"
        ? (item.default as () => unknown)()
        : (item.default ?? null),
    ]),
  ) as T;

  // useForm 有 12 个必选泛型参数（validator 通道），validators 走 any 化宽松契约（同 context.ts FormInstance）
  const form = useForm<T, any, any, any, any, any, any, any, any, any, any, any>({
    defaultValues,
    // TanStack 默认在提交失败后 canSubmit=false 且 handleSubmit 被门控静默拦截，
    // 用户修正字段值后将永远无法再次提交（搜索表单致命）。
    // 放开门控：每次点击都执行完整校验流，失败走错误分发，成功才走 onSubmit。
    canSubmitWhenInvalid: true,
    ...(schema ? { validators: { onSubmit: schema } } : {}),
    ...(onSubmit ? { onSubmit: ({ value }) => onSubmit({ value }) } : {}),
    ...formOptions,
  });

  return {
    items,
    form,
    resetToDefaults: () => form.reset(),
    // canSubmitWhenInvalid 已放开门控：每次 handleSubmit 都执行完整校验流（R30 校验语义单点化）
    submit: async () => {
      await form.handleSubmit();
      return form.state.isFieldsValid;
    },
    actions,
  };
}
