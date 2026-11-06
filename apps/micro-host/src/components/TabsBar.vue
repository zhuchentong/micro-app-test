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
    <!-- 品牌 logo(设计稿 node 91:1:标签栏左侧 36px;占位图标,右距 14 含 gap 4 补偿) -->
    <div aria-hidden="true" class="tabs-brand">
      <icon-svg-logo />
    </div>
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
      <Button
        class="tab-close"
        size="sm"
        type="button"
        variant="ghost"
        :aria-label="`关闭 Tab · ${tab.title}`"
        @click.stop="closeTab(tab.id)"
        @keydown.stop
      >×</Button>
    </div>
    <span v-if="tabs.tabs.length === 0" class="tabs-placeholder">打开子应用后在此显示页签</span>
  </div>
</template>

<style scoped>
/* 标签栏(设计稿 node 91:1「标签栏」:48px #F5FAFD 底跨用 --app-bg-raised(light=n25)) */
.tabs-bar {
  flex: none;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  overflow-x: auto;
  background: var(--app-bg-raised);
  border-bottom: 1px solid var(--app-border);
}

/* 品牌 logo 占位:36px,右距 10 + 容器 gap 4 = 设计稿 14 */
.tabs-brand {
  flex: none;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-brand);
  font-size: 36px;
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
  transition:
    background 0.15s ease,
    color 0.15s ease;
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

/* 关闭按钮:tu-design Button(ghost/sm)打底,scoped 覆盖回微型规格;默认透明,hover 行/按钮时显现 */
.tab-close {
  height: auto;
  min-width: 0;
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-3);
  font-size: 14px;
  line-height: 1;
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
