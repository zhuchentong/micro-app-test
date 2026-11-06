<script setup lang="ts">
import { DatePicker as ArkDatePicker } from "@ark-ui/vue/date-picker";
import type { PropType } from "vue";
import { cn } from "../../../lib/utils";
import ChevronIcon from "../icon-shared/ChevronIcon.vue";

/**
 * 视图导航条（内部件）。必须渲染在 <ArkDatePicker.View> 子树内：
 * Prev/NextTrigger 的 view 参数由 View provide（ViewPropsContext），
 * 放在 View 外会落到默认 { view: "day" }，month/year 视图下
 * GOTO.NEXT 被 machine guard 的 event.view 短路成 focusNextPage（翻页月，表现为无反应）。
 */
const props = defineProps({
  /** 导航条服务的视图，决定中间内容形态：day=ViewTrigger（上钻）/ month=年份 / year=年代 */
  view: { type: String as PropType<"day" | "month" | "year">, required: true },
});

const viewControlCls = "flex items-center justify-between px-1 pb-3";
const navBtnCls =
  "text-muted-foreground inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40";
const viewTriggerCls =
  "hover:bg-accent inline-flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-sm font-semibold text-foreground outline-none transition-colors disabled:pointer-events-none";
const viewTitleCls = "text-sm font-semibold text-foreground";

/**
 * 年代范围文本（zag 无现成 part，由 focusedValue.year 推算）：2026 → "2020 - 2029"
 * @param year - 聚焦年份
 * @returns "起 - 止" 形式的年代范围文本
 */
function decadeRange(year: number | undefined): string {
  const start = Math.floor((year ?? 0) / 10) * 10;
  return `${start} - ${start + 9}`;
}
</script>

<template>
  <ArkDatePicker.ViewControl :class="cn(viewControlCls, $attrs.class)">
    <ArkDatePicker.PrevTrigger :class="navBtnCls">
      <slot name="prev-icon"><ChevronIcon class="size-4 rotate-180" /></slot>
    </ArkDatePicker.PrevTrigger>

    <ArkDatePicker.Context v-slot="context">
      <!-- day：ViewTrigger 上钻钮（内容原样自 CalendarBody 迁入，视觉零回归） -->
      <ArkDatePicker.ViewTrigger v-if="props.view === 'day'" :class="viewTriggerCls">
        <ArkDatePicker.RangeText />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-3.5 opacity-50"
        >
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
        </svg>
      </ArkDatePicker.ViewTrigger>
      <!-- month：年份标题（ViewTrigger 承载——DatePicker 可上钻 year；
           锁定组件下 zag getNextView 无下级 → 原生 disabled，点击钳制） -->
      <ArkDatePicker.ViewTrigger v-else-if="props.view === 'month'" :class="viewTriggerCls">
        {{ context.focusedValue?.year }}
      </ArkDatePicker.ViewTrigger>
      <!-- year：年代范围 -->
      <span v-else :class="viewTitleCls">{{ decadeRange(context.focusedValue?.year) }}</span>
    </ArkDatePicker.Context>

    <ArkDatePicker.NextTrigger :class="navBtnCls">
      <slot name="next-icon"><ChevronIcon class="size-4" /></slot>
    </ArkDatePicker.NextTrigger>
  </ArkDatePicker.ViewControl>
</template>
