<script setup lang="ts">
import { computed } from "vue";
import Counter from "../components/Counter.vue";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { useThemeStore, useUserStore } from "@repo/store";

// props 是 startApp 时注入的一次性快照,此后不再更新
const props = useHostProps();
// 实时状态走 store 同步(host:state → 按 rev 判重 → $patch)
const themeStore = useThemeStore();
const userStore = useUserStore();

const injectedUser = computed(() => props?.user.name ?? "独立运行(无主应用数据)");
const injectedTheme = computed(() => props?.theme ?? "-");
</script>

<template>
  <main class="page">
    <Card class="transition-colors" size="sm" title="主应用注入的 props(启动快照)">
      <dl>
        <dt>运行模式</dt>
        <dd>{{ isWujie() ? "wujie 微前端" : "独立运行" }}</dd>
        <dt>用户</dt>
        <dd>{{ injectedUser }}</dd>
        <dt>主题</dt>
        <dd>{{ injectedTheme }}</dd>
      </dl>
      <p class="hint">props 仅在 startApp 时注入,切换主题后不会更新;实时状态见下方。</p>
    </Card>

    <Card class="transition-colors" size="sm" title="实时状态(store 同步)">
      <dl>
        <dt>用户</dt>
        <dd>{{ userStore.user.name || "—" }}</dd>
        <dt>主题</dt>
        <dd>{{ themeStore.theme }}</dd>
      </dl>
      <p class="hint">经 host:state 同步,与主应用实时一致 —— 在主应用侧栏切换主题即可验证。</p>
    </Card>

    <Card class="transition-colors" size="sm" title="保活验证">
      <p class="hint">点击 +1 后切换到另一个子应用再切回,计数保留说明 wujie 保活生效。</p>
      <Counter />
    </Card>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  max-width: 560px;
}

dl {
  margin: 0;
  display: grid;
  grid-template-columns: 72px 1fr;
  row-gap: 8px;
  font-size: 14px;
}

dt {
  color: var(--app-text-2);
}

dd {
  margin: 0;
}

.hint {
  font-size: 13px;
  color: var(--app-text-2);
  margin: 0 0 8px;
}
</style>
