<script setup lang="ts">
import type { PropType } from "vue";
import type {
  FormRenderDefinition,
  FormRenderFormApi,
  FormRenderItem,
  WidgetRenderReturn,
} from "./types";
import { computed, provide, ref } from "vue";
import { Button } from "../../../components/ui/button";
import { FORM_KEY } from "../../../components/ui/form/context";
import { cn } from "../../../lib/utils";
import FormRenderField from "./FormRenderField.vue";
import { widgetRenders } from "./widgets";

// boolean flags 用运行时声明 + default: undefined 禁用 Vue 的 Boolean casting
// （casting 会让未传的 prop 变 false，"缺省跟随 searchable" 语义失效；Checkbox/Dialog 同款约定）
const props = defineProps({
  /** 聚合式（推荐）：defineForm 返回的定义对象 */
  definition: { type: Object as PropType<FormRenderDefinition<any>> },
  /** 拆分式：与 <Form :form> 模式兼容（与 definition 二选一，definition 优先） */
  form: { type: Object as PropType<FormRenderFormApi> },
  items: { type: Array as PropType<FormRenderItem<any>[]> },
  searchable: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  submitable: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 缺省跟随 searchable */
  resetable: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 缺省跟随 submitable */
  cancelable: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  searchText: { type: String },
  submitText: { type: String },
  resetText: { type: String },
  /** 栅格最小列宽 px（auto-fill 自适应列数） */
  minWidth: { type: Number },
});

const emit = defineEmits<{
  search: [];
  submit: [];
  reset: [];
  cancel: [];
}>();

const instance = props.definition?.form ?? props.form;
const items = computed(() => props.definition?.items ?? props.items ?? []);

if (import.meta.env.DEV && !instance) {
  console.warn(
    "[tu-design] <FormRender> 需要 definition 或 form + items（definition/form 不支持运行时切换）",
  );
}

// S2：FormField 依赖 inject(FORM_KEY)，本组件替代 <Form> 的 provide 职责
provide(FORM_KEY, instance as never);

// S1：form.state 非响应式，响应式 values 只能经 useSelector 订阅建立；
// visible 过滤与 WidgetContext.values 一律消费它，渲染路径禁读 form.state.*
const valuesRef = instance
  ? instance.useSelector((s: any) => s.values)
  : ref<Record<string, unknown>>({});

const r = widgetRenders<any>();

function widgetOf(item: FormRenderItem<any>): WidgetRenderReturn<any> {
  return item.render ? item.render(r) : r.input();
}

const visibleItems = computed(() =>
  items.value.filter((item) =>
    typeof item.visible === "function"
      ? item.visible(valuesRef.value as never)
      : item.visible !== false,
  ),
);

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${props.minWidth ?? 320}px, 1fr))`,
}));

function spanStyle(span?: number | "full") {
  if (span === "full") return { gridColumn: "1 / -1" };
  if (typeof span === "number") return { gridColumn: `span ${span}` };
  return undefined;
}

// ---- 按钮解析（A1 块级互斥）：definition.actions 存在 → 七项全量 actions 域解析，props 域不参与；
// actions 未配置 → 现状 props 域解析（含缺省跟随），行为逐字节不变
const actions = props.definition?.actions;
const searchable = computed(() => (actions ? actions.searchable : props.searchable) ?? false);
const submitable = computed(() => (actions ? actions.submitable : props.submitable) ?? false);
const showReset = computed(
  () => (actions ? actions.resetable : props.resetable) ?? !!searchable.value,
);
const showCancel = computed(
  () => (actions ? actions.cancelable : props.cancelable) ?? !!submitable.value,
);
const showActions = computed(
  () => searchable.value || submitable.value || showReset.value || showCancel.value,
);
const resolvedSearchText = computed(
  () => (actions ? actions.searchText : props.searchText) ?? "搜索",
);
const resolvedSubmitText = computed(
  () => (actions ? actions.submitText : props.submitText) ?? "提交",
);
const resolvedResetText = computed(() => (actions ? actions.resetText : props.resetText) ?? "重置");

// A6：actions 存在且显式传了任一按钮 prop → definition 优先，DEV 警告一次
// （actions 存在 + props 全缺省是正常用法——如 TableRender 内置区经条件传递不传 searchable——不告警）
if (import.meta.env.DEV && actions) {
  const provided =
    props.searchable !== undefined ||
    props.submitable !== undefined ||
    props.resetable !== undefined ||
    props.cancelable !== undefined ||
    props.searchText !== undefined ||
    props.submitText !== undefined ||
    props.resetText !== undefined;
  if (provided) {
    console.warn(
      "[tu-design] <FormRender> definition.actions 与按钮 props 同传，已按 actions 渲染。",
    );
  }
}

/**
 * I4：校验失败时 isFieldsValid=false，不 emit；成功后才 emit（事件回调中一次性读取不受 S1 限制）。
 * 校验语义单点化（R30）：definition 存在时复用 definition.submit()；拆分式 :form + :items 走内联逻辑
 * @param mode - 提交语义："search" 触发 search 事件（查询按钮），"submit" 触发 submit 事件
 */
async function submit(mode: "search" | "submit") {
  if (!instance) return;
  let valid: boolean;
  if (props.definition) {
    valid = await props.definition.submit();
  } else {
    await instance.handleSubmit();
    valid = instance.state.isFieldsValid;
  }
  if (!valid) return;
  if (mode === "search") emit("search");
  else emit("submit");
}

function onReset() {
  if (props.definition) {
    props.definition.resetToDefaults();
  } else {
    instance?.reset();
  }
  emit("reset");
}

defineExpose({
  form: instance,
  items,
  resetToDefaults: () =>
    props.definition ? props.definition.resetToDefaults() : instance?.reset(),
});
</script>

<template>
  <div :class="cn('grid gap-4', $attrs.class)" :style="gridStyle">
    <div v-for="item in visibleItems" :key="String(item.key)" :style="spanStyle(item.span)">
      <FormRenderField :item="item" :widget="widgetOf(item)" :values="valuesRef" />
    </div>
    <div v-if="showActions" class="col-span-full flex justify-end gap-2">
      <slot name="actions">
        <Button v-if="searchable" @click="submit('search')">
          {{ resolvedSearchText }}
        </Button>
        <Button v-if="showReset" variant="outline" @click="onReset">
          {{ resolvedResetText }}
        </Button>
        <Button v-if="submitable" @click="submit('submit')">
          {{ resolvedSubmitText }}
        </Button>
        <Button v-if="showCancel" variant="outline" @click="emit('cancel')"> 取消 </Button>
      </slot>
    </div>
  </div>
</template>
