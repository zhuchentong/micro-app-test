<script setup lang="ts">
import { computed } from "vue";
import DefaultLayout from "./layouts/DefaultLayout.vue";
import TableLayout from "./layouts/TableLayout.vue";
import FormLayout from "./layouts/FormLayout.vue";

/**
 * 页面容器:按 layout 分发到对应布局骨架,所有 props/slots 原样透传。
 *
 * - layout="default"(缺省):默认布局,随内容增高;
 * - layout="table":表格页(form/table/pagination 三区,全高填充,超高表格区内滚);
 * - layout="form":表单页(表单区/常驻底部操作栏,全高填充)。
 * 填充模式由 layout 类型固有决定,不依赖路由/meta。
 * 约束:无状态(不依赖 store),纯 props + slots,wujie 保活下安全;
 * 样式仅消费 --app-* 语义 token。
 */
defineOptions({ name: "PageContainer" });

type PageLayoutName = "default" | "table" | "form";

const props = withDefaults(defineProps<{ layout?: PageLayoutName }>(), {
  layout: "default",
});

const registry = { default: DefaultLayout, table: TableLayout, form: FormLayout };

const comp = computed(() => registry[props.layout]);
</script>

<template>
  <component :is="comp" class="page-container">
    <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </component>
</template>
