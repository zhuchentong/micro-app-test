<script setup lang="ts">
import { computed, ref } from "vue";
import { PageContainer } from "@repo/share/ui/PageContainer";

// 保留路由 name(Home.vue 的 RouterLink 按 name 跳转);definePage 为编译宏,无需 import
definePage({ name: "table" });

/**
 * PageContainer 验证页:layout="table" 分发到表格页骨架。
 * slots(toolbar/footer)经 PageContainer 原样透传;
 * tu-design 组件(Button/Input)走 auto-import(config-vite 的 Components dirs 扫描)。
 */
interface Row {
  id: number;
  name: string;
  role: string;
  status: "启用" | "停用";
}

const rows: Row[] = [
  { id: 1, name: "张伟", role: "前端", status: "启用" },
  { id: 2, name: "王芳", role: "后端", status: "启用" },
  { id: 3, name: "李娜", role: "测试", status: "停用" },
  { id: 4, name: "刘强", role: "运维", status: "启用" },
  { id: 5, name: "陈静", role: "前端", status: "停用" },
];

const keyword = ref("");

const filtered = computed(() => {
  const k = keyword.value.trim();
  if (!k) return rows;
  return rows.filter((r) => r.name.includes(k) || r.role.includes(k));
});
</script>

<template>
  <PageContainer layout="table">
    <template #toolbar>
      <Input v-model="keyword" placeholder="搜索姓名或角色…" />
      <span class="count">共 {{ filtered.length }} 条</span>
    </template>

    <table class="demo-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>角色</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in filtered" :key="row.id">
          <td>{{ row.id }}</td>
          <td>{{ row.name }}</td>
          <td>{{ row.role }}</td>
          <td>
            <span class="status" :class="{ off: row.status === '停用' }">{{ row.status }}</span>
          </td>
        </tr>
        <tr v-if="filtered.length === 0">
          <td class="empty" colspan="4">无匹配数据</td>
        </tr>
      </tbody>
    </table>

    <template #footer>
      <Button size="sm" variant="outline">上一页</Button>
      <span class="page-no">1 / 1</span>
      <Button size="sm" variant="outline">下一页</Button>
    </template>
  </PageContainer>
</template>

<style scoped>
.demo-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--app-fs-body);
}

.demo-table th,
.demo-table td {
  text-align: left;
  padding: var(--app-space-2) var(--app-space-3);
  border-bottom: 1px solid var(--app-border);
}

.demo-table th {
  font-size: var(--app-fs-caption);
  font-weight: var(--app-fw-caption);
  color: var(--app-text-2);
}

.demo-table tbody tr:hover {
  background: var(--app-bg-hover);
}

.count,
.page-no {
  font-size: var(--app-fs-caption);
  color: var(--app-text-2);
}

.status {
  color: var(--app-success);
}

.status.off {
  color: var(--app-text-2);
}

.empty {
  text-align: center;
  color: var(--app-text-2);
  padding: var(--app-space-5) 0;
}
</style>
