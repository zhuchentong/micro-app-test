<script setup lang="ts">
import { ref } from "vue";
import { appConfig } from "../app.config";
import { appBus } from "../bus";

/** 模拟账号表(写死,仅供登录演示) */
const ACCOUNTS: Record<string, { password: string; user: { id: string; name: string } }> = {
  admin: { password: "123456", user: { id: "u-admin", name: "管理员" } },
  guest: { password: "123456", user: { id: "u-guest", name: "访客" } },
};

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin() {
  if (loading.value) return;
  error.value = "";

  const account = ACCOUNTS[username.value.trim()];
  if (!account || account.password !== password.value) {
    // 校验失败:仅提示,不清空已输入的用户名
    error.value = "用户名或密码错误,请重试";
    return;
  }

  // 模拟 300ms 网络延迟后上报登录,嵌入模式 host 收到事件后销毁本实例
  loading.value = true;
  await new Promise((resolve) => setTimeout(resolve, 300));
  appBus.reportLogin(account.user);
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-[var(--app-bg-page)] p-6">
    <div
      class="w-full max-w-sm rounded-xl border p-8 shadow-sm transition-colors"
      :style="{ borderColor: 'var(--app-border)', background: 'var(--app-header-bg)' }"
    >
      <!-- 品牌标识 -->
      <div class="mb-6 flex items-center gap-3">
        <span class="size-3 rounded-full bg-[var(--app-accent)]" />
        <h1 class="text-lg font-semibold text-[var(--app-text-1)]">{{ appConfig.name }}</h1>
      </div>

      <!-- 错误提示区 -->
      <p
        v-if="error"
        class="mb-4 rounded-md border px-3 py-2 text-sm"
        role="alert"
        :style="{
          color: 'var(--app-destructive)',
          background: 'var(--app-destructive-soft)',
          borderColor: 'var(--app-destructive-soft)',
        }"
      >
        {{ error }}
      </p>

      <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-[var(--app-text-2)]" for="login-username">用户名</label>
          <Input
            id="login-username"
            v-model="username"
            autocomplete="username"
            placeholder="请输入用户名"
            required
            type="text"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-[var(--app-text-2)]" for="login-password">密码</label>
          <Input
            id="login-password"
            v-model="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            required
            type="password"
          />
        </div>

        <Button type="submit" :disabled="loading" class="mt-2 w-full">
          {{ loading ? "登录中…" : "登录" }}
        </Button>
      </form>

      <p class="mt-6 text-center text-xs text-[var(--app-text-3)]">
        演示账号:admin / 123456 · guest / 123456
      </p>
    </div>
  </div>
</template>
