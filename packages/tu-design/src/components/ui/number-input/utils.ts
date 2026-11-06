/**
 * Ark ValueChangeDetails → number|null（空串/NaN 归一 null，numberOrNull 为可单测的纯函数）
 * @param details - Ark NumberInput 的 ValueChangeDetails
 * @returns 有效数字；空串或 NaN 时返回 null
 */
export function numberOrNull(details: { value: string; valueAsNumber: number }): number | null {
  return details.value === "" || Number.isNaN(details.valueAsNumber) ? null : details.valueAsNumber;
}
