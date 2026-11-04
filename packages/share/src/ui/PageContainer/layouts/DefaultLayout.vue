<script setup lang="ts">
import PageHeader from "../PageHeader.vue";

/**
 * 默认布局(纯 slot 模板):可选页面标题区 + 内容区。
 *
 * - 填充模式由 layout 类型固有决定:default=随内容(min-height:100%,超高由外层
 *   滚动容器滚动);table/form=全高填充(height:100%,内部 flex 分配);
 * - App 级导航/用户信息由消费方自己的壳层(App.vue)负责,本组件只做页面级骨架;
 * - 与 table/form 形态对称:内容经默认 slot 进入,标题区 props/slots 可选。
 */
defineOptions({ name: "DefaultLayout" });

defineProps<{ title?: string }>();
</script>

<template>
  <div class="page-layout-default">
    <!-- 空标题区(无 title 且无 description/actions)整块不渲染,避免留空条 -->
    <PageHeader v-if="title || $slots.description || $slots.actions" :title="title">
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>
    <main class="default-content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* 卡片容器:子应用侧自绘(设计稿 node 91:114 的内层白卡,20px 圆角与 host 衬底卡同档)。
 * host 的 pane-stage 预留 --stage-inset: 12px 作为卡外留白,blank 布局 inset 0 时贴满。
 * 随内容模式(min-height):内容超高由 host tab-pane 滚动,顶部圆角滚出视野(已知取舍)。
 * surface 亮色即 #FFFFFF,暗色自动降级为深色卡面。 */
.page-layout-default {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-3xl);
  background: var(--app-bg-surface);
  overflow: hidden;
}

.default-content {
  flex: 1;
  min-width: 0;
  padding: var(--app-space-4) var(--app-space-5);
}
</style>
