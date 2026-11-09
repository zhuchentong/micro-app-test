<script setup lang="ts">
import { useRouter } from "vue-router";
import { PageContainer } from "@repo/share/ui/PageContainer";
import { products } from "../../mock/products";

/**
 * 路由返回演示 · 商品列表:Tab 内 router.push 进详情,host 停点栈入栈,
 * 面包屑「返回」按钮从置灰变亮。与「产品」页对比:产品页 openTab 开新 Tab,
 * 不入当前 Tab 的停点栈,面包屑返回门控不变。
 */
const router = useRouter();

/**
 * Tab 内导航进详情(非 openTab):路由变化经 App.vue 上报 syncTabRoute,
 * host applyTabRoute 入停点栈,栈深 ≥2 面包屑「返回」亮起。
 * @param id 商品 id
 */
function openDetail(id: string): void {
  void router.push(`/goods/${id}`);
}
</script>

<template>
  <PageContainer layout="default">
    <main class="page">
      <h2>商品列表</h2>
      <p class="hint">
        本页演示面包屑「返回」:点击商品在<b>当前 Tab 内</b>跳转详情(不开新 Tab),
        host 面包屑「返回」按钮亮起;点击面包屑可逐级回退。
      </p>
      <ul class="goods-list">
        <li v-for="product in products" :key="product.id">
          <Button class="goods-item" type="button" variant="ghost" @click="openDetail(product.id)">
            <span class="name">{{ product.name }}</span>
            <span class="meta">¥{{ product.price }}</span>
            <span class="desc">{{ product.desc }}</span>
          </Button>
        </li>
      </ul>
    </main>
  </PageContainer>
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

.goods-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* tu-design Button(ghost)打底:scoped 覆盖为卡片式 grid 列表项(与产品页观感一致) */
.goods-item {
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

.goods-item:hover {
  border-color: var(--app-accent-soft-border);
}

.goods-item .name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-1);
}

.goods-item .meta {
  font-size: 13px;
  color: var(--app-accent-deep);
  text-align: right;
}

.goods-item .desc {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--app-text-2);
}
</style>
