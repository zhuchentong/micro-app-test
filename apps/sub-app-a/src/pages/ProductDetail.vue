<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { subBus } from "../bus";
import { findProduct } from "../mock/products";

const route = useRoute();
const hostProps = useHostProps();

const product = computed(() => findProduct(String(route.params.id)));
// 保活验证计数:切换 Tab 再切回,计数保留说明实例未重建
const counter = ref(0);

/**
 * Tab 模式:标题回报给主应用(带真实产品名,host 只信任激活 Tab);
 * 独立运行时直接写 document.title。
 */
watch(
  product,
  (item) => {
    const title = item ? `${item.name} #${item.id}` : "产品详情";
    if (isWujie() && hostProps?.tab) {
      subBus.syncTabTitle(title);
    } else {
      document.title = title;
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="page">
    <template v-if="product">
      <h2>{{ product.name }} #{{ product.id }}</h2>
      <dl>
        <dt>价格</dt>
        <dd>¥{{ product.price }}</dd>
        <dt>介绍</dt>
        <dd>{{ product.desc }}</dd>
      </dl>

      <section class="card">
        <h3>保活验证</h3>
        <p class="hint">点击 +1 后切换到其他 Tab 再切回,计数保留说明保活生效。</p>
        <div class="counter">
          <button type="button" @click="counter += 1">+1</button>
          <span>{{ counter }}</span>
        </div>
      </section>
    </template>
    <p v-else class="missing">未找到产品 #{{ route.params.id }}</p>
  </main>
</template>

<style scoped>
.page {
  padding: 20px;
  max-width: 560px;
}

.page h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

dl {
  margin: 0 0 16px;
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

.card {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 16px;
  background: var(--app-bg-surface);
}

.card h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.hint {
  font-size: 13px;
  color: var(--app-text-2);
  margin: 0 0 12px;
}

.counter {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
}

.counter button {
  padding: 6px 16px;
  border: 1px solid var(--app-accent-deep);
  border-radius: 8px;
  background: var(--app-accent-soft);
  color: var(--app-accent-deep);
  font-size: 14px;
  cursor: pointer;
}

.missing {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
