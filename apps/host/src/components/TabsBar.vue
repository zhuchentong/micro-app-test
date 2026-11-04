<script setup lang="ts">
import { useTabsStore } from "../stores/tabs";
import { useLogsStore } from "../stores/logs";

/** 常驻 tabs-bar:显隐由布局 meta 声明(App.vue 层 v-show);wujie 容器层与本组件无关,永不卸载 */
defineOptions({ name: "HostTabsBar" });

const tabs = useTabsStore();
const logs = useLogsStore();

/**
 * 关闭 Tab:先移除记录再销毁实例(见 tabs store),日志记录关闭动作
 * @param id 待关闭 Tab 的确定性去重键
 */
async function closeTab(id: string): Promise<void> {
  const title = tabs.tabs.find((tab) => tab.id === id)?.title ?? id;
  await tabs.closeTab(id);
  logs.add("host", `关闭 Tab · ${title}`);
}
</script>

<template>
  <div class="tabs-bar" role="tablist">
    <!-- Tab 用 div role=tab:内部需要嵌套真关闭按钮,button 嵌套 button 属无效 HTML(lint 强制) -->
    <div
      v-for="tab in tabs.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ 'tab-item--active': tab.id === tabs.activeId, cold: tab.state === 'cold' }"
      role="tab"
      :aria-selected="tab.id === tabs.activeId"
      tabindex="0"
      @click="tabs.activate(tab.id)"
      @keydown.enter.prevent="tabs.activate(tab.id)"
      @keydown.space.prevent="tabs.activate(tab.id)"
    >
      <span aria-hidden="true" class="tab-dot" />
      <span class="tab-title">{{ tab.title }}</span>
      <span v-if="tab.state === 'cold'" class="reload-hint" title="实例已释放,激活时重建">↻</span>
      <button
        class="tab-close"
        type="button"
        :aria-label="`关闭 Tab · ${tab.title}`"
        @click.stop="closeTab(tab.id)"
        @keydown.stop
      >×</button>
    </div>
    <span v-if="tabs.tabs.length === 0" class="tabs-placeholder">打开子应用后在此显示页签</span>
  </div>
</template>

<style scoped>
.tabs-bar {
  flex: none;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  overflow-x: auto;
  /* 比页面底稍浅一档的衬底:与下方内容区形成层次 */
  background: var(--app-bg-surface);
  border-bottom: 1px solid var(--app-border);
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px 0 12px;
  border: 1px solid transparent;
  border-radius: var(--app-radius-md);
  background: transparent;
  color: var(--app-text-2);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab-item:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: -2px;
}

.tab-item:hover {
  color: var(--app-text-1);
}

.tab-item--active {
  border-color: var(--app-border);
  background: var(--app-bg-raised);
  color: var(--app-text-1);
  font-weight: 600;
}

/* 激活态左侧青色圆点(非激活透明占位,避免文字抖动) */
.tab-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: transparent;
}

.tab-item--active .tab-dot {
  background: var(--app-accent);
}

.tab-item.cold {
  opacity: 0.7;
  border-style: dashed;
}

.tab-title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reload-hint {
  font-size: 12px;
  color: var(--app-text-3);
}

/* 关闭按钮默认透明,hover 行/按钮时显现 */
.tab-close {
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-3);
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tab-item:hover .tab-close,
.tab-item--active .tab-close,
.tab-close:focus-visible {
  opacity: 1;
}

.tab-close:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 1px;
}

.tab-close:hover {
  background: var(--app-destructive-soft);
  color: var(--app-destructive);
}

.tabs-placeholder {
  padding: 0 4px;
  font-size: 12px;
  color: var(--app-text-3);
}
</style>
