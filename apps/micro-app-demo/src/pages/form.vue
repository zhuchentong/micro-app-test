<script setup lang="ts">
import { ref } from "vue";
import { FormLayout } from "@repo/share/ui/PageContainer";
import { Button } from "@repo/tu-design/button";
import { Input } from "@repo/tu-design/input";

// 纯约定下 name 会退化为 path "/form",保留原 name 以兼容 Home.vue 的 RouterLink 引用
definePage({ name: "form" });

/**
 * FormLayout 验证页:表单区 + 常驻底部操作栏(flex,不用 sticky)。
 * 具名布局直接使用(绕过 PageContainer 分发壳),验证具名导出可用。
 * tu-design 组件走显式 import(验证 @repo/tu-design 子路径导出在子应用内可用)。
 */
const name = ref("");
const email = ref("");
const saved = ref(false);

function submit() {
  saved.value = true;
}

function reset() {
  name.value = "";
  email.value = "";
  saved.value = false;
}
</script>

<template>
  <FormLayout>
    <form class="demo-form" @submit.prevent="submit">
      <div class="field">
        <span>姓名</span>
        <Input v-model="name" placeholder="请输入姓名" />
      </div>
      <div class="field">
        <span>邮箱</span>
        <Input v-model="email" placeholder="请输入邮箱" />
      </div>
      <p v-if="saved" class="saved">
        已提交:{{ name || "—" }} / {{ email || "—" }}(演示,未持久化)
      </p>
    </form>

    <template #footer>
      <Button variant="outline" @click="reset">重置</Button>
      <Button @click="submit">保存</Button>
    </template>
  </FormLayout>
</template>

<style scoped>
.demo-form {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-4);
  max-width: 420px;
}

.demo-form .field {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-1);
  font-size: var(--app-fs-body);
  color: var(--app-text-1);
}

.saved {
  margin: 0;
  font-size: var(--app-fs-caption);
  color: var(--app-success);
}
</style>
