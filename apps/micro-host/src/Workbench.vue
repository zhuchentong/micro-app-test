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
      <!-- ① 单层衬底卡:仅装饰,可随布局显隐;加载占位由本体承担,
           子应用(接入 PageContainer 的)就绪后其 DefaultLayout 卡坐落 12px 留白区(设计稿 node 91:114) -->
      <div v-show="meta.framed" aria-hidden="true" class="pane-frame" />

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

/* ① 单层衬底卡(设计稿 node 91:114:20px 圆角 + #DCE8F2 底 → --app-bg-substrate)。
   子应用(接入 PageContainer 的)就绪后其 DefaultLayout 卡坐落于同一区域 12px 留白内;
   未接入的子应用(a/b)整页以自身 page 底覆盖本卡,观感回退为无衬底 */
.pane-frame {
  position: absolute;
  inset: 0;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-3xl);
  background: var(--app-bg-substrate);
}

/* ③ 容器层:常驻,只切 inset 不切显隐 */
.pane-area {
  position: absolute;
  inset: var(--stage-inset);
}

.tab-pane {
  /* 子应用内 absolute 的兜底包含块收拢到本容器(否则穿透到 .pane-area 定位漂移) */
  position: relative;
  height: 100%;
  /* 容器内滚动:子应用内容超高不出 pane,整页(body)不再出现滚动。
     已知取舍:v-show 的 display:none 切换会重置 scrollTop,Tab 切换后滚动归顶
     (真·保留需求出现时再升级为 visibility 叠放方案) */
  overflow: auto;
  /* 细滚动条贴语义 token,暗色主题自动适配(Chrome 121+/Firefox 标准属性) */
  scrollbar-width: thin;
  scrollbar-color: var(--app-border) transparent;
}

/* wujie 容器元素默认 display:inline 且无高度,高度链在此断链:
   block 化 + 撑满,子应用 #app 的 height:100% 才有确定父高 */
.tab-pane > wujie-app {
  display: block;
  height: 100%;
}

.empty-state {
  position: absolute;
  inset: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--app-text-2);
  font-size: 15px;
  /* 虚线框卡片:保留「未加载子应用」的卡片视觉语义(单层衬底卡模式下由本层承担) */
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-surface);
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
