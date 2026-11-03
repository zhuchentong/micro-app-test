/** 秒数 → "1 分 05 秒"(>=60 秒才显示分,向下取整分、秒补零) */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} 秒`;
  return `${m} 分 ${String(rest).padStart(2, "0")} 秒`;
}

/** Date → HH:MM:SS,与 host 日志时间格式一致 */
export function formatClockTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
