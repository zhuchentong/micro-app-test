<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isWujie, useHostProps } from "@repo/wujie-kit/sub";
import { PageContainer } from "@repo/share/ui/PageContainer";
import { appBus } from "../../bus";
import { findProduct, products } from "../../mock/products";

const route = useRoute();
const router = useRouter();
const hostProps = useHostProps();

// 约定式路由使 params 为全部页面参数的联合类型,用 in 收窄出详情页的 id
const goodsId = computed(() => ("id" in route.params ? String(route.params.id) : ""));
const goods = computed(() => findProduct(goodsId.value));
// 「下一件」:列表循环推进,持续入栈演示深栈回退(栈深 ≥2 面包屑返回亮起)
const nextId = computed(() => {
  const index = products.findIndex((item) => item.id === goodsId.value);
  if (index < 0) return "";
  return products[(index + 1) % products.length]!.id;
});
// 保活验证计数:切换 Tab 再切回,计数保留说明实例未重建
const counter = ref(0);

/**
 * Tab 模式:标题回报给主应用(带真实商品名,host 只信任激活 Tab);
 * 独立运行时直接写 document.title。
 */
watch(
  goods,
  (item) => {
    const title = item ? `${item.name} #${item.id}` : "商品详情";
    if (isWujie() && hostProps?.tab) {
      appBus.syncTabTitle(title);
    } else {
      document.title = title;
    }
  },
  { immediate: true },
);

/** 「下一件」:Tab 内 router.push(不开新 Tab),停点栈继续入栈 */
function goNext(): void {
  if (nextId.value) void router.push(`/goods/${nextId.value}`);
}
</script>

<template>
  <PageContainer layout="default">
    <main class="page">
      <template v-if="goods">
        <h2>{{ goods.name }} #{{ goods.id }}</h2>
        <dl>
          <dt>价格</dt>
          <dd>¥{{ goods.price }}</dd>
          <dt>介绍</dt>
          <dd>{{ goods.desc }}</dd>
        </dl>

        <Card size="sm" title="面包屑「返回」门控规则">
          <ul class="rules">
            <li>刚进 Tab 时停点栈深 1,host 面包屑「返回」<b>置灰</b>;页内跳转后栈深 ≥2 <b>亮起</b>。</li>
            <li>点「下一件」继续入栈;点 host 面包屑「返回」逐级回退,退到最初停点再置灰。</li>
            <li>回退后不可前进(无 forward 栈);刷新页面 / 关闭 Tab 重开,栈清空重新置灰。</li>
            <li>「产品」页的 openTab 是开新 Tab,不影响本 Tab 的停点栈。</li>
          </ul>
        </Card>

        <Card size="sm" title="保活验证">
          <p class="hint">点击 +1 后切换到其他 Tab 再切回,计数保留说明保活生效。</p>
          <div class="counter">
            <Button size="sm" type="button" variant="outline" @click="counter += 1">+1</Button>
            <span>{{ counter }}</span>
          </div>
        </Card>

        <Button class="next" type="button" variant="outline" :disabled="!nextId" @click="goNext">
          下一件{{ nextId ? `(#${nextId})` : "" }}
        </Button>
      </template>
      <p v-else class="missing">未找到商品 #{{ goodsId }}</p>
    </main>
  </PageContainer>
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

.rules {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--app-text-2);
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

.next {
  margin-top: 16px;
}

.missing {
  font-size: 14px;
  color: var(--app-text-2);
}
</style>
