import { type DateValue, parseDate } from "@ark-ui/vue/date-picker";
import type { InjectionKey } from "vue";

/**
 * 日期家族共享模块：ISO 值域解析（日期/月/年/区间）与日历样式常量。
 * 供 DatePicker / DateRangePicker 及后续变体（Month/Year/WeekPicker）复用。
 */

/**
 * TCalendar 双形态标记：Picker 在 setup 里 provide(true)，
 * 弹层内的 TCalendar 检测到宿主即保持「纯卡片内核」（embedded 内嵌形态，不自建 Root）；
 * 独立使用时 inject 落到 fallback false → 自建 Root（standalone 独立形态，恒开）。
 */
export const CALENDAR_IN_PICKER: InjectionKey<boolean> = Symbol("tu-calendar-in-picker");

/** ISO 日期串格式（yyyy-MM-dd）：日期家族公开值域的基础格式 */
export type IsoDate = string;

/**
 * zag 按 locale 分隔符清洗键入字符（zh-CN 为 "/"），解析前统一归一为 "-"。
 * @param raw - 原始键入文本
 * @returns 去除首尾空白并把 "/" 归一为 "-" 后的文本
 */
function normalizeSeparators(raw: string): string {
  return raw.trim().replace(/\//g, "-");
}

/**
 * "yyyy-MM-dd" → DateValue（@internationalized/date 纯日历解析，无时区参与）。
 * 兼容 "/" 分隔（zag 键入清洗路径，如 "2026/10/09"），归一后做严格 ISO 校验；
 * 非法/非补零（如 "abc"、"2026-2-3"）返回 undefined，由调用方忽略。
 * @param raw - 待解析的日期文本
 * @returns 解析成功返回对应 DateValue；非法/非补零输入返回 undefined
 */
export function parseIsoDate(raw: string): DateValue | undefined {
  const normalized = normalizeSeparators(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  try {
    return parseDate(normalized);
  } catch {
    return undefined;
  }
}

/**
 * DateValue → "yyyy-MM-dd"（CalendarDate.toString 原生 ISO 输出）。
 * @param date - 目标日期
 * @returns ISO "yyyy-MM-dd" 格式日期串
 */
export function formatIsoDate(date: DateValue): string {
  return date.toString();
}

/**
 * "yyyy-MM" → DateValue（锚定 1 日）；非法/非补零返回 undefined。
 * @param raw - 待解析的月份文本
 * @returns 解析成功返回锚定 1 日的 DateValue；非法输入返回 undefined
 */
export function parseIsoMonth(raw: string): DateValue | undefined {
  const normalized = normalizeSeparators(raw);
  if (!/^\d{4}-\d{2}$/.test(normalized)) return undefined;
  try {
    return parseDate(`${normalized}-01`);
  } catch {
    return undefined;
  }
}

/**
 * DateValue → "yyyy-MM"（不能走 toString()，会带 day）。
 * @param date - 目标日期
 * @returns 补零的 "yyyy-MM" 格式月份串
 */
export function formatIsoMonth(date: DateValue): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

/**
 * "yyyy" → DateValue（锚定 1 月 1 日）；非四位年份返回 undefined。
 * @param raw - 待解析的年份文本
 * @returns 解析成功返回锚定 1 月 1 日的 DateValue；非法输入返回 undefined
 */
export function parseIsoYear(raw: string): DateValue | undefined {
  const normalized = normalizeSeparators(raw);
  if (!/^\d{4}$/.test(normalized)) return undefined;
  try {
    return parseDate(`${normalized}-01-01`);
  } catch {
    return undefined;
  }
}

/**
 * DateValue → "yyyy"。
 * @param date - 目标日期
 * @returns 四位年份串
 */
export function formatIsoYear(date: DateValue): string {
  return String(date.year);
}

// —— 周粒度换算（WeekPicker 复用）：不引入新依赖，纯日历计算 ——

/**
 * locale 周起点（1=周一 … 7=周日，ISO 语义）。
 * 取 Intl.Locale.weekInfo.firstDay（Node ≥ 22 / 现代浏览器可用），异常兜底周一。
 * @param locale - BCP 47 语言标签（如 "zh-CN"、"en-US"）
 * @returns 该 locale 的周起点序号（1=周一 … 7=周日）；异常时兜底 1（周一）
 */
function localeFirstDay(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number } })
      .weekInfo;
    if (info?.firstDay && info.firstDay >= 1 && info.firstDay <= 7) return info.firstDay;
  } catch {
    // 非法 locale 落兜底
  }
  return 1;
}

/**
 * DateValue → 周起点（跟随 locale；zh-CN 周一起始、en-US 周日起始）。
 * @param date - 目标日期
 * @param locale - BCP 47 语言标签，决定每周起始日
 * @returns 该日期所在周的起点日期
 */
export function weekStartOf(date: DateValue, locale = "zh-CN"): DateValue {
  // 纯公历星期计算：ISO 日期 → UTC Date 的 getUTCDay（0=周日…6=周六），无时区歧义
  const utcDay = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  const firstDayIndex = localeFirstDay(locale) % 7; // 归一为 0=周日…6=周六
  const diff = (utcDay - firstDayIndex + 7) % 7;
  return diff === 0 ? date : date.subtract({ days: diff });
}

/**
 * DateValue → 周终点（= 周起点 + 6 天）。
 * @param date - 目标日期
 * @param locale - BCP 47 语言标签，决定每周起始日
 * @returns 该日期所在周的终点日期
 */
export function weekEndOf(date: DateValue, locale = "zh-CN"): DateValue {
  return weekStartOf(date, locale).add({ days: 6 });
}

/**
 * 两日期是否同属一周（跟随 locale）。
 * @param a - 待比较的第一个日期
 * @param b - 待比较的第二个日期
 * @param locale - BCP 47 语言标签，决定每周起始日
 * @returns 两日期同属一周时返回 true，否则返回 false
 */
export function isSameWeek(a: DateValue, b: DateValue, locale = "zh-CN"): boolean {
  return weekStartOf(a, locale).compare(weekStartOf(b, locale)) === 0;
}

/**
 * DateValue → "yyyy-MM-dd ~ yyyy-MM-dd"（所在周区间，输入框回显用）。
 * @param date - 目标日期
 * @param locale - BCP 47 语言标签，决定每周起始日
 * @returns 形如 "yyyy-MM-dd ~ yyyy-MM-dd" 的周区间串
 */
export function formatIsoWeek(date: DateValue, locale = "zh-CN"): string {
  return `${formatIsoDate(weekStartOf(date, locale))} ~ ${formatIsoDate(weekEndOf(date, locale))}`;
}

/**
 * 区间解析：逐侧 parseIsoDate + 顺序归一（start ≤ end）；null / 任一侧非法返回 undefined。
 * @param raw - [起, 止] 文本二元组，可为 null 或 undefined
 * @returns 顺序归一后的 [start, end]；输入为空或任一侧非法时返回 undefined
 */
export function parseIsoRange(
  raw: [string, string] | null | undefined,
): [DateValue, DateValue] | undefined {
  if (!raw) return undefined;
  const start = parseIsoDate(raw[0] ?? "");
  const end = parseIsoDate(raw[1] ?? "");
  if (!start || !end) return undefined;
  return start.compare(end) <= 0 ? [start, end] : [end, start];
}

// —— 输入框侧共享样式常量（Control 容器与触发钮；卡片视觉见 calendar/CalendarBody）——

export const controlCls =
  "border-input flex h-9 w-full items-center overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] data-invalid:border-destructive data-invalid:ring-destructive/20 data-invalid:ring-[3px]";
export const iconBtnCls =
  "text-muted-foreground/70 hover:text-foreground flex h-full w-8 shrink-0 items-center justify-center outline-none disabled:cursor-not-allowed disabled:opacity-30";
