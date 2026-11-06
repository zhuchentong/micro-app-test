<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { appBus } from "../../bus";
import { findProduct } from "../../mock/products";

const route = useRoute();
const hostProps = useHostProps();

// 约定式路由使 params 为全部页面参数的联合类型,用 in 收窄出详情页的 id
const productId = computed(() => ("id" in route.params ? String(route.params.id) : ""));
const product = computed(() => findProduct(productId.value));
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
      appBus.syncTabTitle(title);
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

      <Card title="保活验证">
        <p class="hint">点击 +1 后切换到其他 Tab 再切回,计数保留说明保活生效。</p>
        <div class="counter">
          <Button size="sm" type="button" variant="outline" @click="counter += 1">+1</Button>
          <span>{{ counter }}</span>
        </div>
      </Card>
    </template>
    <p v-else class="missing">未找到产品 #{{ productId }}</p>
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

.missing {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
