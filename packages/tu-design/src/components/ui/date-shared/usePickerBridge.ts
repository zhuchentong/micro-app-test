import type { DateValue } from "@ark-ui/vue/date-picker";
import { computed, ref } from "vue";
import { useControlledBoolean } from "../overlay-shared/useControlledBoolean";

export interface PickerBridgeOptions {
  /** 受控值：undefined 走内部非受控，null 表示空 */
  modelValue: () => string | null | undefined;
  defaultValue: () => string | null | undefined;
  open: () => boolean | undefined;
  defaultOpen: () => boolean;
  disabled: () => boolean | undefined;
  readOnly: () => boolean | undefined;
  /** 对外字符串值 → zag DateValue */
  parse: (raw: string) => DateValue | undefined;
  /** 非受控初值归一（如周选择器归一到所在周起始日） */
  normalizeDefault?: (raw: string) => string | null;
  /** zag DateValue → 对外字符串值 */
  toPublicValue: (date: DateValue) => string | null;
  onUpdateModelValue: (value: string | null) => void;
  onUpdateOpen: (open: boolean) => void;
}

/**
 * 单值日期选择器的受控桥接：值以内部 ref 为镜像、Root 恒走受控，
 * 开合复用 useControlledBoolean，openFromInput 统一「点击/↓ 输入框即开」。
 * @param options - 桥接配置：值与开合的受控/非受控读写、解析与回写转换、事件回调
 * @returns rootValue（zag 受控值）、isOpen 与 setOpen（开合状态）、openFromInput（输入框驱动开弹层）与 handleValueUpdate（日历值更新处理）
 */
export function usePickerBridge(options: PickerBridgeOptions) {
  const initial = options.defaultValue();
  const internalValue = ref<string | null>(
    initial ? (options.normalizeDefault?.(initial) ?? initial) : null,
  );

  const selected = computed(() => {
    const raw = options.modelValue() !== undefined ? options.modelValue() : internalValue.value;
    return options.parse(raw ?? "");
  });
  // zag value 为 DateValue[] 数组形态，单选语义收敛为 [date] | []
  const rootValue = computed<DateValue[]>(() => (selected.value ? [selected.value] : []));

  const { isOpen, setOpen } = useControlledBoolean({
    controlled: options.open,
    defaultValue: options.defaultOpen,
    onChange: options.onUpdateOpen,
  });

  function handleValueUpdate(next: DateValue[]) {
    const value = next[0] ? options.toPublicValue(next[0]) : null;
    internalValue.value = value;
    options.onUpdateModelValue(value);
  }

  // 点击/键盘 ↓ 输入框即开弹层（zag 默认仅 Trigger 开，openOnClick 默认关闭；
  // 显式驱动保证各环境行为一致并显式走受控 emit）
  function openFromInput() {
    if (options.disabled() || options.readOnly() || isOpen.value) return;
    setOpen(true);
  }

  return { rootValue, isOpen, setOpen, openFromInput, handleValueUpdate };
}
