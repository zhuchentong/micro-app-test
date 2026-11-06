<script setup lang="ts">
import type { DateValue } from "@ark-ui/vue/date-picker";
import { DatePicker as ArkDatePicker } from "@ark-ui/vue/date-picker";
import type { PropType } from "vue";
import { computed, inject, ref } from "vue";
import { cn } from "../../../lib/utils";
import { CALENDAR_IN_PICKER, formatIsoDate, parseIsoDate } from "../date-shared/shared";
import CalendarBody from "./CalendarBody.vue";

const props = defineProps({
  /** 视图形态：day=日网格（可切月/年）；standalone 时 month/year 同时派生视图锁定 */
  mode: { type: String as PropType<"day" | "month" | "year">, default: "day" },
  /** 日视图并排月数 */
  numOfMonths: { type: Number, default: 1 },
  /** 受控值（"yyyy-MM-dd"）；仅 standalone 独立形态生效，embedded 值归宿主 Picker */
  modelValue: { type: String as PropType<string | null | undefined>, default: undefined },
  /** 非受控初值（仅 standalone） */
  defaultValue: { type: String, default: undefined },
  /** 可选下界（"yyyy-MM-dd"，含当日；仅 standalone） */
  min: { type: String, default: undefined },
  /** 可选上界（"yyyy-MM-dd"，含当日；仅 standalone） */
  max: { type: String, default: undefined },
  /** 不可选日期谓词（参数为 ark 的 DateValue；仅 standalone） */
  isDateUnavailable: {
    type: Function as PropType<(date: DateValue) => boolean>,
    default: undefined,
  },
  /** 文案与周起点跟随 locale（仅 standalone；embedded 随宿主 Picker） */
  locale: { type: String, default: "zh-CN" },
  /** 周选择形态：日视图下整周高亮（与 TWeekPicker 配套） */
  week: { type: Boolean, default: false },
});

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

// 双形态探测：Picker 弹层内（宿主 provide）为 embedded 内嵌形态（纯卡片内核）；独立使用为 standalone 独立形态（自建 Root）
const standalone = !inject(CALENDAR_IN_PICKER, false);

// standalone 时 month/year 形态即语义 → 派生视图锁定（day 不锁，保留月/年切换）
const viewLock = computed(() => (props.mode === "day" ? undefined : props.mode));

// —— 受控桥（DatePicker 同款简化版，单值无 mirror 需求）——
const internalValue = ref<string | null>(props.defaultValue ?? null);
const selected = computed(() => {
  const raw = props.modelValue !== undefined ? props.modelValue : internalValue.value;
  return parseIsoDate(raw ?? "");
});
// zag value 为 DateValue[] 数组形态，单选语义收敛为 [date] | []
const rootValue = computed<DateValue[]>(() => (selected.value ? [selected.value] : []));

const minDate = computed(() => parseIsoDate(props.min ?? ""));
const maxDate = computed(() => parseIsoDate(props.max ?? ""));

function handleValueUpdate(next: DateValue[]) {
  const value = next[0] ? formatIsoDate(next[0]) : null;
  internalValue.value = value;
  emit("update:modelValue", value);
}
</script>

<template>
  <!--
    standalone 独立形态：自建 Root。:open="true" 恒开——独立卡片没有输入框/触发钮
    去打开弹层，不恒开则 Content hidden 整卡不可见。沿用已验证的 Root > Content 直渲形态
    （无 Positioner：卡片非浮层，就地渲染）。
    外层 div 承接 attrs（Ark Root 不透传 attrs，实测 class/id 会丢）；w-fit 收缩包裹卡片宽度。
  -->
  <div v-if="standalone" :class="cn('w-fit', $attrs.class)">
    <ArkDatePicker.Root
      :model-value="rootValue"
      :open="true"
      :num-of-months="props.numOfMonths"
      :min-view="viewLock"
      :max-view="viewLock"
      :min="minDate"
      :max="maxDate"
      :is-date-unavailable="props.isDateUnavailable"
      :locale="props.locale"
      @update:model-value="handleValueUpdate"
    >
      <ArkDatePicker.Content>
        <CalendarBody
          :mode="props.mode"
          :num-of-months="props.numOfMonths"
          :week="props.week"
          :locale="props.locale"
        >
          <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
          <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
        </CalendarBody>
      </ArkDatePicker.Content>
    </ArkDatePicker.Root>
  </div>

  <!-- embedded 内嵌形态：宿主 Picker 的 Root 供能，纯卡片内核 -->
  <CalendarBody
    v-else
    :mode="props.mode"
    :num-of-months="props.numOfMonths"
    :week="props.week"
    :locale="props.locale"
  >
    <template v-if="$slots['prev-icon']" #prev-icon><slot name="prev-icon" /></template>
    <template v-if="$slots['next-icon']" #next-icon><slot name="next-icon" /></template>
  </CalendarBody>
</template>
