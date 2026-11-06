<script setup lang="ts">
import { DatePicker as ArkDatePicker } from "@ark-ui/vue/date-picker";
import type { DateValue } from "@ark-ui/vue/date-picker";
import { computed } from "vue";
import { cn } from "../../../lib/utils";
import { isSameWeek } from "../date-shared/shared";
import CalendarNav from "./CalendarNav.vue";

const props = withDefaults(
  defineProps<{
    /** 渲染裁剪：渲染哪个视图块；「锁定视图」由 picker Root 的 minView/maxView 承担（卡片不持 Root） */
    mode?: "day" | "month" | "year";
    /** 日视图并排月数 */
    numOfMonths?: number;
    /** 周选择形态：日视图下与选中值同周的格子全部 data-selected（整周高亮，周起点随 locale） */
    week?: boolean;
    /** 周起点 locale（week 形态下生效） */
    locale?: string;
  }>(),
  { mode: "day", numOfMonths: 1, week: false, locale: "zh-CN" },
);

// —— 卡片视觉常量（打磨单点：视觉调整只改本文件）——
const cardCls = computed(() => [props.numOfMonths > 1 ? "w-[40rem]" : "w-80", "p-4"]);
// 导航条（ViewControl/Prev/Next/ViewTrigger）样式常量已迁 calendar/CalendarNav.vue
// 日视图双层格子（naive 式「命中大、视觉小」）：
// trigger = 全格命中区 + range 无缝条带层（primary/10；行首行尾圆角由模板按列位补）
//           + week 整周条带层（data-week-selected：实心 primary 无缝整行，行首行尾圆角同上）
//           + week hover 预览（行挂 group/week-row，任意格 hover 时同周全行亮 primary/10 浅条带；
//             非 week 形态无 group/week-row 宿主，变体永不命中，零副作用）
// dot     = 24px 视觉圆点层，hover/选中/今天/禁用色全落此层（经 group-* 读取 trigger 状态）
// outside-view = Card 自标「格不属于本表锚点月」，range/选中视觉在补位格上失效，
//                且补位格不可点击（naive excluded 语义：仅作日期连续性视觉提示；
//                week 条带上补位格降为 40% 透明，保留整行连续性）
const dayTriggerCls =
  "group relative flex h-8 w-full cursor-pointer items-center justify-center outline-none data-[outside-view]:pointer-events-none data-[disabled]:pointer-events-none data-[in-range]:not-data-[outside-view]:not-data-[range-start]:not-data-[range-end]:bg-primary/10 data-[range-start]:rounded-l-[3px] data-[range-end]:rounded-r-[3px] data-[week-selected]:bg-primary data-[week-selected]:data-[outside-view]:bg-primary/40 data-[week-selected]:hover:data-[outside-view]:bg-primary/40 group-hover/week-row:not-data-[week-selected]:not-data-[outside-view]:bg-primary/10 group-hover/week-row:data-[outside-view]:not-data-[week-selected]:bg-primary/5";
const dayDotCls =
  "flex size-6 items-center justify-center rounded-[3px] text-sm transition-colors group-hover:not-group-data-[week-selected]:bg-accent group-data-[focus]:not-group-data-[outside-view]:not-group-data-[week-selected]:bg-accent group-data-[selected]:not-group-data-[week-selected]:not-group-data-[outside-view]:bg-primary group-data-[selected]:not-group-data-[week-selected]:not-group-data-[outside-view]:font-medium group-data-[selected]:not-group-data-[week-selected]:not-group-data-[outside-view]:text-primary-foreground group-data-[week-selected]:bg-transparent group-data-[week-selected]:font-medium group-data-[week-selected]:text-primary-foreground group-data-[week-selected]:hover:bg-white/20 group-data-[today]:not-group-data-[selected]:text-primary group-data-[today]:not-group-data-[selected]:font-semibold group-data-[unavailable]:line-through group-data-[unavailable]:opacity-30 group-data-[disabled]:opacity-40 group-data-[outside-view]:opacity-30";
// 月/年视图单层格子（沿用小圆角语言；range 变体单选无副作用，此处不涉及）
const cellCls =
  "flex h-9 w-full items-center justify-center rounded-[3px] text-sm outline-none hover:bg-accent data-[selected]:bg-primary data-[selected]:font-medium data-[selected]:text-primary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-40";
// table-fixed：7 列日视图 / 4 列月年视图均分列宽，表头与内容同走原生 table 布局
const tableCls = "w-full min-w-0 flex-1 table-fixed border-collapse";
const headCellCls =
  "text-muted-foreground h-8 border-x-0! border-t-0! border-b border-border p-0! text-center! text-xs! align-middle font-normal whitespace-nowrap";
const bodyCellCls = "border-0! p-0! text-center";
// 宿主斑马线防御：VitePress .vp-doc tr:nth-child(2n) 背景污染（与 range 条带浅色撞车）
const rowCls = "bg-transparent!";

// —— 补位格自标记（ zag data-outside-range 是「整机可见范围」语义，双月时相邻月表内
// 的上月尾/下月头格不带它，range/选中视觉会跨表重复高亮；Card 按锚点月自行判定）——
type TableCtx = {
  getOffset(duration: { months: number }): { visibleRange: { start: DateValue } };
};

/**
 * 表 i 的锚点月起点（zag getOffset({months: i-1}).visibleRange.start）
 * @param context - zag Table 上下文
 * @param i - 表序号（1-based，相对当前锚点月偏移 i-1 个月）
 * @returns 该表锚点月的起始日期
 */
function tableAnchor(context: TableCtx, i: number): DateValue | undefined {
  return context.getOffset({ months: i - 1 })?.visibleRange?.start;
}

/**
 * 格子日期不属于锚点月（年或月不一致）即为补位格
 * @param day - 格子日期
 * @param anchor - 所在表的锚点月起点
 * @returns 是否为补位格
 */
function isOutsideView(day: DateValue, anchor: DateValue | undefined): boolean {
  return !!anchor && (day.year !== anchor.year || day.month !== anchor.month);
}

/**
 * 周形态整周高亮：day 与选中值同周 → 补 data-selected（语义标记，供 zag 状态/测试判定）
 * 与 data-week-selected（视觉标记，驱动 trigger 整行条带与 dot 层反色变体）；
 * 非 week 形态返回空对象，完全不下发属性，选中视觉交回 zag 原生绑定，避免 fallthrough 覆盖。
 * 走显式函数而非模板内联，避免与日视图 v-for 的 `week` 循环变量同名遮蔽。
 * @param day - 格子日期
 * @param selected - 当前选中日期集合（单选语义，取首个）
 * @returns 需下发的 data 属性对象（无命中时为空对象）
 */
function weekSelectedAttrs(
  day: DateValue,
  selected: DateValue[] | undefined,
): Record<string, string> {
  return weekSelected(day, selected) ? { "data-selected": "", "data-week-selected": "" } : {};
}

function weekSelected(day: DateValue, selected: DateValue[] | undefined): boolean {
  return !!props.week && !!selected?.[0] && isSameWeek(day, selected[0], props.locale);
}
</script>

<template>
  <div :class="cn(cardCls)">
    <template v-if="mode === 'day'">
      <ArkDatePicker.View :view="'day'">
        <!-- day 视图导航条在 View 内：viewProps=day → GOTO.NEXT=focusNextPage（翻月） -->
        <CalendarNav view="day">
          <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
          <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
        </CalendarNav>
        <ArkDatePicker.Context v-slot="context">
          <div class="flex gap-6">
            <ArkDatePicker.Table v-for="i in numOfMonths" :key="i" :class="tableCls">
              <ArkDatePicker.TableHead>
                <ArkDatePicker.TableRow :class="rowCls">
                  <ArkDatePicker.TableHeader
                    v-for="(weekDay, id) in context.weekDays"
                    :key="id"
                    :class="headCellCls"
                  >
                    {{ weekDay.narrow }}
                  </ArkDatePicker.TableHeader>
                </ArkDatePicker.TableRow>
              </ArkDatePicker.TableHead>
              <ArkDatePicker.TableBody>
                <ArkDatePicker.TableRow
                  :class="cn(rowCls, props.week && 'group/week-row')"
                  v-for="(week, id) in context.getOffset({ months: i - 1 }).weeks"
                  :key="id"
                >
                  <ArkDatePicker.TableCell
                    v-for="(day, colIdx) in week"
                    :key="day.toString()"
                    :value="day"
                    :class="bodyCellCls"
                  >
                    <ArkDatePicker.TableCellTrigger
                      :class="
                        cn(
                          dayTriggerCls,
                          colIdx === 0 && 'rounded-l-[3px]',
                          colIdx === week.length - 1 && 'rounded-r-[3px]',
                        )
                      "
                      :data-outside-view="
                        isOutsideView(day, tableAnchor(context, i)) ? '' : undefined
                      "
                      v-bind="weekSelectedAttrs(day, context.value)"
                    >
                      <span :class="dayDotCls">{{ day.day }}</span>
                    </ArkDatePicker.TableCellTrigger>
                  </ArkDatePicker.TableCell>
                </ArkDatePicker.TableRow>
              </ArkDatePicker.TableBody>
            </ArkDatePicker.Table>
          </div>
        </ArkDatePicker.Context>
      </ArkDatePicker.View>

      <ArkDatePicker.View :view="'month'">
        <!-- 切换视图导航条也在 View 内：DatePicker 切月视图后 GOTO.NEXT=focusNextYear（修复 backlog） -->
        <CalendarNav view="month">
          <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
          <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
        </CalendarNav>
        <ArkDatePicker.Context v-slot="context">
          <ArkDatePicker.Table :class="tableCls">
            <ArkDatePicker.TableBody>
              <ArkDatePicker.TableRow
                :class="rowCls"
                v-for="(monthsRow, id) in context.getMonthsGrid({ columns: 4, format: 'short' })"
                :key="id"
              >
                <ArkDatePicker.TableCell
                  v-for="month in monthsRow"
                  :key="month.value.toString()"
                  :value="month.value"
                  :class="bodyCellCls"
                >
                  <ArkDatePicker.TableCellTrigger :class="cn(cellCls)">
                    {{ month.label }}
                  </ArkDatePicker.TableCellTrigger>
                </ArkDatePicker.TableCell>
              </ArkDatePicker.TableRow>
            </ArkDatePicker.TableBody>
          </ArkDatePicker.Table>
        </ArkDatePicker.Context>
      </ArkDatePicker.View>

      <ArkDatePicker.View :view="'year'">
        <CalendarNav view="year">
          <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
          <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
        </CalendarNav>
        <ArkDatePicker.Context v-slot="context">
          <ArkDatePicker.Table :class="tableCls">
            <ArkDatePicker.TableBody>
              <ArkDatePicker.TableRow
                :class="rowCls"
                v-for="(yearsRow, id) in context.getYearsGrid({ columns: 4 })"
                :key="id"
              >
                <ArkDatePicker.TableCell
                  v-for="year in yearsRow"
                  :key="year.value.toString()"
                  :value="year.value"
                  :class="bodyCellCls"
                >
                  <ArkDatePicker.TableCellTrigger :class="cn(cellCls)">
                    {{ year.label }}
                  </ArkDatePicker.TableCellTrigger>
                </ArkDatePicker.TableCell>
              </ArkDatePicker.TableRow>
            </ArkDatePicker.TableBody>
          </ArkDatePicker.Table>
        </ArkDatePicker.Context>
      </ArkDatePicker.View>
    </template>

    <ArkDatePicker.View v-else-if="mode === 'month'" :view="'month'">
      <!-- 导航条必须在 View 子树内：Prev/NextTrigger 才能拿到 view="month"（GOTO.NEXT=focusNextYear） -->
      <CalendarNav view="month">
        <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
        <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
      </CalendarNav>
      <ArkDatePicker.Context v-slot="context">
        <ArkDatePicker.Table :class="tableCls">
          <ArkDatePicker.TableBody>
            <ArkDatePicker.TableRow
              :class="rowCls"
              v-for="(monthsRow, id) in context.getMonthsGrid({ columns: 4, format: 'short' })"
              :key="id"
            >
              <ArkDatePicker.TableCell
                v-for="month in monthsRow"
                :key="month.value.toString()"
                :value="month.value"
                :class="bodyCellCls"
              >
                <ArkDatePicker.TableCellTrigger :class="cn(cellCls)">
                  {{ month.label }}
                </ArkDatePicker.TableCellTrigger>
              </ArkDatePicker.TableCell>
            </ArkDatePicker.TableRow>
          </ArkDatePicker.TableBody>
        </ArkDatePicker.Table>
      </ArkDatePicker.Context>
    </ArkDatePicker.View>

    <ArkDatePicker.View v-else :view="'year'">
      <!-- 导航条必须在 View 子树内：Prev/NextTrigger 才能拿到 view="year"（GOTO.NEXT=focusNextDecade） -->
      <CalendarNav view="year">
        <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
        <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
      </CalendarNav>
      <ArkDatePicker.Context v-slot="context">
        <ArkDatePicker.Table :class="tableCls">
          <ArkDatePicker.TableBody>
            <ArkDatePicker.TableRow
              :class="rowCls"
              v-for="(yearsRow, id) in context.getYearsGrid({ columns: 4 })"
              :key="id"
            >
              <ArkDatePicker.TableCell
                v-for="year in yearsRow"
                :key="year.value.toString()"
                :value="year.value"
                :class="bodyCellCls"
              >
                <ArkDatePicker.TableCellTrigger :class="cn(cellCls)">
                  {{ year.label }}
                </ArkDatePicker.TableCellTrigger>
              </ArkDatePicker.TableCell>
            </ArkDatePicker.TableRow>
          </ArkDatePicker.TableBody>
        </ArkDatePicker.Table>
      </ArkDatePicker.Context>
    </ArkDatePicker.View>
  </div>
</template>
