<script setup lang="ts">
import { computed } from "vue";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { useThemeStore, useUserStore } from "@repo/store";
import { PageContainer } from "@repo/share/ui/PageContainer";
import { openTab } from "../bus";
import Counter from "../components/Counter.vue";

// props 是 startApp 时注入的一次性快照,此后不再更新
const props = useHostProps();
const userStore = useUserStore();
const themeStore = useThemeStore();

const injectedUser = computed(() => props?.user.name ?? "独立运行(无主应用数据)");
</script>

<template>
  <PageContainer layout="default">
    <main class="page">
      <Card size="sm" title="PageContainer 布局验证清单">
        <ul>
          <li>
            <strong>DefaultLayout(slot 模板)</strong>:当前页 ——
            随内容增高,内容超高由 host 容器滚动。
          </li>
          <li>
            <strong>TableLayout(全高填充)</strong>:
            <Button type="button" variant="ghost" @click="openTab('/table')">表格页示例</Button>
            —— 工具栏 / 表格区 / 底部分页区,表格区内滚,tu-design 组件走 auto-import;
            宿主内新开 Tab,独立运行回退本页跳转。
          </li>
          <li>
            <strong>FormLayout(全高填充)</strong>:
            <Button type="button" variant="ghost" @click="openTab('/form')">表单页示例</Button>
            —— flex 常驻底部操作栏,tu-design 组件走显式 import;
            宿主内新开 Tab,独立运行回退本页跳转。
          </li>
        </ul>
      </Card>

      <Card size="sm" title="运行状态">
        <dl>
          <dt>运行模式</dt>
          <dd>{{ isWujie() ? "wujie 微前端" : "独立运行" }}</dd>
          <dt>注入用户</dt>
          <dd>{{ injectedUser }}</dd>
          <dt>实时用户</dt>
          <dd>{{ userStore.user.name || "—" }}</dd>
          <dt>实时主题</dt>
          <dd>{{ themeStore.theme }}</dd>
        </dl>
      </Card>

      <Card size="sm" title="保活计数">
        <p class="hint">点击 +1 后切换到其他 Tab 再切回,计数保留说明 wujie 保活生效。</p>
        <Counter />
      </Card>

      <Card size="sm" title="Popover shadow DOM 适配验证">
        <p class="hint">
          wujie shadow 沙箱下面板应自动降级到本子应用挂载容器（样式/主题变量继承完整），
          不落入主应用 body；独立运行时仍传送 body（行为不变）。
        </p>
        <Popover>
          <Button type="button" variant="outline">打开 Popover</Button>
          <template #content>气泡内容（shadow 内渲染）</template>
        </Popover>
      </Card>

      <Card size="sm" title="浮层沙箱定位推广验证（Select / Tooltip / DatePicker）">
        <p class="hint">
          wujie graft 下 strategy 默认 fixed（absolute 包含块错位修正），面板应锚定各自
          触发器（gap≈8px、水平居中），且无 [wujie warn] getElementById 告警。
        </p>
        <div class="demo-row">
          <Select :items="['选项甲', '选项乙', '选项丙']" placeholder="打开 Select" />
          <Tooltip content="Tooltip 气泡（沙箱 fixed 定位）">
            <Button type="button" variant="outline">悬停 Tooltip</Button>
          </Tooltip>
          <DatePicker placeholder="打开 DatePicker" />
        </div>
      </Card>
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

.demo-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--app-space-3);
  align-items: center;
}
</style>
