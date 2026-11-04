<script setup lang="ts">
defineOptions({ name: "HostWorkbench" });
import { computed } from "vue";
import { useTabsStore } from "./stores/tabs";
import { useLayoutStore } from "./stores/layout";
import { layouts } from "./layouts";

/** 常驻容器层:pane-area(含 wujie 容器)永不随布局卸载/移动,视觉层(衬底卡)由 meta 显隐 */
const tabs = useTabsStore();
const layoutStore = useLayoutStore();

/** 当前布局 meta:直接从 store 读,不层层传 props */
const meta = computed(() => layouts[layoutStore.current].meta);
</script>

<template>
  <section class="workbench">
    <div v-show="meta.showBreadcrumb" class="breadcrumb">
      <span class="breadcrumb-root">工作台</span>
      <template v-if="tabs.activeTab">
        <span aria-hidden="true" class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ tabs.activeTab.title }}</span>
      </template>
    </div>

    <div class="pane-stage" :class="{ 'stage--framed': meta.framed }">
      <!-- ① 衬底视觉层:仅装饰,可随布局显隐 -->
      <div v-show="meta.framed" aria-hidden="true" class="pane-frame" />
      <!-- ② 内白卡视觉层:空态只有衬底(「未加载子应用」语义) -->
      <div
        v-show="meta.framed && tabs.tabs.length > 0"
        aria-hidden="true"
        class="pane-frame-inner"
      />

      <!-- ③ 容器层:常驻永不隐藏;--stage-inset 由 .stage--framed 切换(衬底留白 vs 全屏) -->
      <div class="pane-area">
        <!-- 每 Tab 一个常驻容器,保活实例不卸载,切换只切显隐;任何布局变化都不得触碰本层 -->
        <div
          v-for="tab in tabs.tabs"
          v-show="tab.id === tabs.activeId"
          :id="`tab-container-${tab.n}`"
          :key="tab.id"
          class="tab-pane"
        />
        <div v-if="!tabs.activeTab" class="empty-state">
          <p>未打开任何页面</p>
          <p class="empty-hint">打开任意子应用页面开始使用</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workbench {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.breadcrumb {
  flex: none;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-raised);
  font-size: var(--app-fs-caption);
}

.breadcrumb-root {
  color: var(--app-text-2);
}

.breadcrumb-sep {
  color: var(--app-text-3);
}

.breadcrumb-current {
  color: var(--app-text-1);
  font-weight: 600;
}

.pane-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  /* 容器层默认贴满 stage;衬底模式下留 12px 空隙露出衬底卡 */
  --stage-inset: 0px;
}

.pane-stage.stage--framed {
  --stage-inset: 12px;
}

/* ① 衬底视觉层 */
.pane-frame {
  position: absolute;
  inset: 0;
  border: 1px solid var(--app-border);
  border-radius: 20px;
  background: var(--app-bg-surface);
}

/* ② 内白卡视觉层 */
.pane-frame-inner {
  position: absolute;
  inset: 12px;
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-raised);
}

/* ③ 容器层:常驻,只切 inset 不切显隐 */
.pane-area {
  position: absolute;
  inset: var(--stage-inset);
}

.tab-pane {
  height: 100%;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--app-text-2);
  font-size: 15px;
}

.empty-state p,
.empty-hint {
  margin: 0;
}

.empty-hint {
  font-size: 12px;
  color: var(--app-text-3);
}
</style>
