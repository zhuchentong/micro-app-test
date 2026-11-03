<script setup lang="ts">
import { computed, useSlots } from "vue";
import { cn } from "../../../lib/utils";
import { cardVariants, type CardVariants } from "./index";

interface Props {
  /** 标题文案，渲染进头部（#title / #header 插槽可覆盖） */
  title?: string;
  /** 描述文案，渲染进头部（#description / #header 插槽可覆盖） */
  description?: string;
  /** 卡片尺寸，联动圆角、字级与分区 padding */
  size?: CardVariants["size"];
  /** 是否显示边框（关闭时同时去掉阴影基底） */
  bordered?: boolean;
  /** 悬浮时提升阴影 */
  hoverable?: boolean;
  /** 可点击卡片：hover 提升 + cursor-pointer */
  interactive?: boolean;
  /** 嵌入式背景（bg-muted/30） */
  embedded?: boolean;
  /** 分区之间显示分隔线（不含 Cover） */
  segmented?: boolean;
  /** 显示关闭按钮，点击触发 close 事件 */
  closable?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  description: undefined,
  size: "default",
  bordered: true,
});

const emit = defineEmits<{ close: [] }>();

const slots = useSlots();

// 分区样式原样搬运自原复合子组件（CardHeader/CardTitle/CardDescription/
// CardAction/CardCover/CardContent/CardFooter），保持视觉与 data-slot 不变
const headerClass =
  "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]";
const titleClass = "font-semibold leading-none tracking-tight";
const descriptionClass = "text-sm text-muted-foreground";
const actionClass =
  "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end";
const coverClass = "-mx-px -mt-px overflow-hidden rounded-t-[inherit]";
const contentClass = "p-6 pt-0";
const footerClass = "flex items-center p-6 pt-0";

// 是否渲染头部：任一头部来源存在即渲染（#header 逃生口 / #action / title / description）
const hasHeader = computed(
  () =>
    Boolean(slots.header) ||
    Boolean(slots.action) ||
    props.title !== undefined ||
    Boolean(slots.title) ||
    props.description !== undefined ||
    Boolean(slots.description),
);

const rootClass = computed(() =>
  cn(
    cardVariants({
      size: props.size,
      bordered: props.bordered,
      hoverable: props.hoverable,
      interactive: props.interactive,
      embedded: props.embedded,
    }),
    props.segmented
      ? [
          "[&>[data-slot]:not(:first-child):not([data-slot=card-cover])]:border-t",
          "[&>[data-slot=card-content]]:pt-6",
          "[&>[data-slot=card-footer]]:pt-6",
        ]
      : undefined,
    props.class,
  ),
);
</script>

<template>
  <div data-slot="card" :class="rootClass">
    <!-- 封面区（原 CardCover）：顶部媒体区，负 margin 贴边 + 圆角裁剪 -->
    <div v-if="slots.cover" data-slot="card-cover" :class="coverClass">
      <slot name="cover" />
    </div>

    <!-- 头部（原 CardHeader）：含 #action 时自动切换为两栏 grid；
         #header 为全自定义逃生口，提供时替代 title/description 头部渲染 -->
    <div v-if="hasHeader" data-slot="card-header" :class="headerClass">
      <template v-if="slots.header">
        <slot name="header" />
      </template>
      <template v-else>
        <h3 v-if="slots.title || props.title" data-slot="card-title" :class="titleClass">
          <slot name="title">{{ props.title }}</slot>
        </h3>
        <p
          v-if="slots.description || props.description"
          data-slot="card-description"
          :class="descriptionClass"
        >
          <slot name="description">{{ props.description }}</slot>
        </p>
      </template>
      <!-- 头部右侧动作区（原 CardAction），无论 #header 是否接管均可叠加 -->
      <div v-if="slots.action" data-slot="card-action" :class="actionClass">
        <slot name="action" />
      </div>
    </div>

    <!-- 内容区（原 CardContent）：默认插槽 -->
    <div v-if="slots.default" data-slot="card-content" :class="contentClass">
      <slot />
    </div>

    <!-- 底部（原 CardFooter） -->
    <div v-if="slots.footer" data-slot="card-footer" :class="footerClass">
      <slot name="footer" />
    </div>

    <button
      v-if="props.closable"
      type="button"
      aria-label="关闭"
      class="absolute right-3 top-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-70 transition-[color,background-color,opacity] hover:bg-muted hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="emit('close')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-4"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>
</template>
