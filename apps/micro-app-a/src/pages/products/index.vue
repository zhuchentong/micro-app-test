<script setup lang="ts">
import { useRouter } from "vue-router";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { subBus } from "../../bus";
import { products } from "../../mock/products";

const router = useRouter();
const hostProps = useHostProps();

/**
 * 点击产品:Tab 模式经 bus 请求主应用开新 Tab(幂等,同参数复用);
 * 独立运行时直接本页跳转详情。
 * @param id 产品 id
 */
function openProduct(id: string): void {
  const page = `/products/${id}`;
  if (isWujie() && hostProps?.tab) {
    subBus.openTab(page);
    return;
  }
  void router.push(page);
}
</script>

<template>
  <main class="page">
    <h2>产品列表</h2>
    <p class="hint">点击产品:在主应用 Tabs 中新开 Tab(同产品复用已有 Tab)。不同产品并存不冲突。</p>
    <ul class="product-list">
      <li v-for="product in products" :key="product.id">
        <Button class="product-item" type="button" variant="ghost" @click="openProduct(product.id)">
          <span class="name">{{ product.name }}</span>
          <span class="meta">¥{{ product.price }}</span>
          <span class="desc">{{ product.desc }}</span>
        </Button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.page {
  padding: 20px;
  max-width: 560px;
}

.page h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  color: var(--app-text-2);
  margin: 0 0 16px;
}

.product-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* tu-design Button(ghost)打底:scoped 覆盖为卡片式 grid 列表项 */
.product-item {
  width: 100%;
  height: auto;
  display: grid;
  justify-content: stretch;
  align-items: stretch;
  gap: 0;
  white-space: normal;
  font-weight: normal;
  text-align: left;
  row-gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-bg-surface);
  cursor: pointer;
  grid-template-columns: 1fr auto;
  transition: border-color 0.2s;
}

.product-item:hover {
  border-color: var(--app-accent-soft-border);
}

.product-item .name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-1);
}

.product-item .meta {
  font-size: 13px;
  color: var(--app-accent-deep);
  text-align: right;
}

.product-item .desc {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--app-text-2);
}
</style>
