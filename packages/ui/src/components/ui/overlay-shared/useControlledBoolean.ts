import { computed, ref, type ComputedRef } from "vue";

export interface ControlledBooleanOptions {
  /** 受控值；返回 undefined 表示非受控（内部状态接管） */
  controlled: () => boolean | undefined;
  /** 非受控初始值 */
  defaultValue?: () => boolean;
  /** 状态变更对外同步（一般 emit("update:open", next)） */
  onChange?: (next: boolean) => void;
}

export interface ControlledBoolean {
  isOpen: ComputedRef<boolean>;
  setOpen: (next: boolean) => void;
}

/**
 * 业务组件惯例：Ark Root 恒走受控，非受控语义由内部 ref 实现。
 * `controlled()` 返回 undefined 时用内部值，否则永远跟随外部 prop。
 */
export function useControlledBoolean(options: ControlledBooleanOptions): ControlledBoolean {
  const internal = ref(options.defaultValue?.() ?? false);
  const isOpen = computed(() => options.controlled() ?? internal.value);

  function setOpen(next: boolean) {
    internal.value = next;
    options.onChange?.(next);
  }

  return { isOpen, setOpen };
}
