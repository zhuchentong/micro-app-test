<script setup lang="ts">
import { computed } from "vue";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { useUserStore } from "@repo/store";
import { PageContainer } from "@repo/share/ui/PageContainer";

// props 是 startApp 时注入的一次性快照,此后不再更新
const props = useHostProps();
const userStore = useUserStore();

const injectedUser = computed(() => props?.user.name ?? "独立运行(无主应用数据)");
</script>

<template>
  <PageContainer layout="default">
    <main class="page">
      <section class="card">
        <h2>PageContainer 布局验证清单</h2>
        <ul>
          <li>
            <strong>DefaultLayout(slot 模板)</strong>:当前页 ——
            随内容增高,内容超高由 host 容器滚动。
          </li>
          <li>
            <strong>TableLayout(全高填充)</strong>:
            <RouterLink :to="{ name: 'table' }">表格页示例</RouterLink>
            —— 工具栏 / 表格区 / 底部分页区,表格区内滚,tu-design 组件走 auto-import。
          </li>
          <li>
            <strong>FormLayout(全高填充)</strong>:
            <RouterLink :to="{ name: 'form' }">表单页示例</RouterLink>
            —— flex 常驻底部操作栏,tu-design 组件走显式 import。
          </li>
        </ul>
      </section>

      <section class="card">
        <h2>运行状态</h2>
        <dl>
          <dt>运行模式</dt>
          <dd>{{ isWujie() ? "wujie 微前端" : "独立运行" }}</dd>
          <dt>注入用户</dt>
          <dd>{{ injectedUser }}</dd>
          <dt>实时用户</dt>
          <dd>{{ userStore.user.name || "—" }}</dd>
        </dl>
      </section>

      <section class="card">
        <h2>Popover shadow DOM 适配验证</h2>
        <p class="hint">
          wujie shadow 沙箱下面板应自动降级到本子应用挂载容器（样式/主题变量继承完整），
          不落入主应用 body；独立运行时仍传送 body（行为不变）。
        </p>
        <Popover>
          <button class="pop-trigger" type="button">打开 Popover</button>
          <template #content>气泡内容（shadow 内渲染）</template>
        </Popover>
      </section>
    </main>
  </PageContainer>
</template>

<style scoped>
.page {
  /* padding 由 default 布局的 .default-content 提供,此处不再叠加 */
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  max-width: 640px;
}

.card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg);
  padding: var(--app-space-4);
  background: var(--app-bg-surface);
}

.card h2 {
  margin: 0 0 var(--app-space-3);
  font-size: var(--app-fs-h3);
  font-weight: var(--app-fw-h3);
}

ul {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
  font-size: var(--app-fs-body);
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 72px 1fr;
  row-gap: var(--app-space-2);
  font-size: var(--app-fs-body);
}

dt {
  color: var(--app-text-2);
}

dd {
  margin: 0;
}

a {
  color: var(--app-accent);
}

.pop-trigger {
  padding: 6px 14px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-lg, 8px);
  background: var(--app-bg-surface);
  color: var(--app-text-1, inherit);
  cursor: pointer;
}
</style>
