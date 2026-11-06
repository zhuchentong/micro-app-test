<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { Toaster, Toast } from "@ark-ui/vue/toast";
import type { ToastPlacement } from "./useToast";
import { cn } from "../../../lib/utils";
import CloseIcon from "../icon-shared/CloseIcon.vue";
import { __configureToaster, __setToastMounted } from "./useToast";

/**
 * Toast 渲染容器：在应用根部挂载一次。
 * 内部按 props 重建 useToast 单例 store，随后所有 toast 方法经单例转发到这里渲染。
 */
const props = defineProps({
  /** 弹出位置 */
  placement: { type: String as () => ToastPlacement, default: "bottom-end" },
  /** 默认自动关闭时长（ms） */
  duration: { type: Number, default: 3000 },
  /** 同屏最大数量，超出排队 */
  max: { type: Number, default: 3 },
});

// setup 阶段同步重建：首次渲染的 <Toaster> 即持有新配置（zag 仅在挂载时消费 store）
const toaster = shallowRef(
  __configureToaster({ placement: props.placement, duration: props.duration, max: props.max }),
);

onMounted(() => __setToastMounted(true));
onBeforeUnmount(() => __setToastMounted(false));

/** 语义 type → token 样式（tokens.css 的 success/warning/info/destructive） */
const typeClass: Record<string, string> = {
  success: "bg-success text-success-foreground",
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
  loading: "bg-primary text-primary-foreground",
  default: "bg-background text-foreground border-border",
};

const rootBase =
  "flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-md border p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[placement*=top]:data-[state=open]:slide-in-from-top-2 data-[placement*=top]:data-[state=closed]:slide-out-to-top-2 data-[placement*=bottom]:data-[state=open]:slide-in-from-bottom-2 data-[placement*=bottom]:data-[state=closed]:slide-out-to-bottom-2";

const rootClass = computed(
  () => (type: string) => cn(rootBase, typeClass[type] ?? typeClass.default),
);
</script>

<template>
  <Toaster :toaster="toaster" v-slot="t">
    <Toast.Root :class="rootClass(String(t.type ?? 'default'))">
      <!-- 语义图标：随 type 着色（loading 旋转） -->
      <span v-if="t.type" class="mt-0.5 shrink-0" :class="{ 'animate-spin': t.type === 'loading' }">
        <slot name="icon" :type="t.type">
          <svg
            v-if="t.type === 'success'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M21.801 10A10 10 0 1 1 17 3.335" />
            <path d="m9 11 3 3L22 4" />
          </svg>
          <svg
            v-else-if="t.type === 'error'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
          <svg
            v-else-if="t.type === 'warning'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <svg
            v-else-if="t.type === 'info'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </slot>
      </span>

      <div class="flex-1">
        <Toast.Title class="text-sm font-semibold">{{ t.title }}</Toast.Title>
        <Toast.Description v-if="t.description" class="mt-1 text-sm opacity-90">
          {{ t.description }}
        </Toast.Description>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <Toast.ActionTrigger
          v-if="t.action"
          class="inline-flex h-8 items-center rounded-sm px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
        />
        <Toast.CloseTrigger
          aria-label="关闭"
          class="inline-flex size-6 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
        >
          <CloseIcon class="size-4" />
          <span class="sr-only">关闭</span>
        </Toast.CloseTrigger>
      </div>
    </Toast.Root>
  </Toaster>
</template>
