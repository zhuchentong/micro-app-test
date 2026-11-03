<script setup lang="ts">
defineOptions({ name: "HostWorkbench" });
import { useTabsStore } from "./stores/tabs";
import { useLogsStore } from "./stores/logs";

/** 常驻内容层:tabs-bar 显隐由当前布局声明,pane 区(含 wujie 容器)永不随布局卸载 */
defineProps<{ showTabsBar: boolean }>();

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
  <section class="workbench">
    <div v-show="showTabsBar" class="tabs-bar" role="tablist">
      <!-- Tab 用 div role=tab:内部需要嵌套真关闭按钮,button 嵌套 button 属无效 HTML(lint 强制) -->
      <div
        v-for="tab in tabs.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === tabs.activeId, cold: tab.state === 'cold' }"
        role="tab"
        :aria-selected="tab.id === tabs.activeId"
        tabindex="0"
        @click="tabs.activate(tab.id)"
        @keydown.enter.prevent="tabs.activate(tab.id)"
        @keydown.space.prevent="tabs.activate(tab.id)"
      >
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
      <span v-if="tabs.tabs.length === 0" class="tabs-placeholder">点击左侧菜单打开子应用页面</span>
    </div>

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
  </section>
</template>

<style scoped>
.workbench {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tabs-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-bg-surface);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--app-border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: var(--app-bg-tab-inactive);
  color: var(--app-text-1);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.tab:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: -2px;
}

.tab:hover {
  background: var(--app-accent-soft);
}

.tab.active {
  background: var(--app-bg-raised);
  border-color: var(--app-accent-soft-border);
  color: var(--app-accent);
  font-weight: 600;
}

.tab.cold {
  opacity: 0.7;
  border-style: dashed;
}

.tab-title {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reload-hint {
  font-size: 12px;
  color: var(--app-text-3);
}

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
  padding: 7px 4px;
  font-size: 13px;
  color: var(--app-text-3);
}

.pane-area {
  flex: 1;
  min-height: 0;
  position: relative;
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
  font-size: 13px;
}
</style>
