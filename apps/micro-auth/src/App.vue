<script setup lang="ts">
import Login from "./pages/Login.vue";
</script>

<template>
  <!-- 授权网关:无侧栏、无菜单上报,单页直出登录卡片;
       登录成功后嵌入模式下 host 销毁本实例,无需视图切换 -->
  <Login />
</template>
