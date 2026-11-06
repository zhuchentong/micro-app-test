<script setup lang="ts">
import { defineForm } from "@repo/tu-design/form-render";
import { defineTable } from "@repo/tu-design/table-render";
import { PageContainer } from "@repo/share/ui/PageContainer";

// 保留路由 name(Home.vue 的 RouterLink 按 name 跳转);definePage 为编译宏,无需 import
definePage({ name: "table" });

/**
 * TableLayout 组合式布局验证页:左侧筛选表单 + 右侧表格 + 右底分页。
 * defineForm 产出 search 传给 defineTable,onLoad(服务端模式模拟)对本地数据
 * 按 params.form 过滤分页——覆盖 search 表单联动、R30 查询/重置链路、
 * R13 单页分页条自隐藏。组件走 unplugin auto-import(dirs 按文件名注册,
 * 无 T 前缀);工厂函数显式 import(vue/vue-router/pinia 之外的 AutoImport 不覆盖)。
 *
 * 横向滚动验证:多列总宽超出容器触发滚动区 overflow-x-auto 横滚;
 * id/name fixed left、操作列 fixed right(sticky 钉住,须配数字 width),
 * 另覆盖 ellipsis/tooltip、currency/date 渲染器与右对齐数值列。
 */
interface Row {
  id: number;
  name: string;
  role: string;
  status: "启用" | "停用";
  email: string;
  department: string;
  city: string;
  amount: number;
  score: number;
  joinDate: Date;
  updatedAt: Date;
}

const roles = ["前端", "后端", "测试", "运维"];
const names = ["张伟", "王芳", "李娜", "刘强", "陈静", "赵磊"];
const departments = ["交易平台", "用户中心", "数据平台", "基础架构", "风控合规"];
const cities = ["北京", "上海", "深圳", "杭州", "成都", "广州"];

// 100 行演示数据:pageSize 20 → 5 页,表格区被数据填满、超高内滚;
// 过滤后 ≤pageSize 行时分页条自动隐藏(R13)
const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: names[i % names.length]!,
  role: roles[i % roles.length]!,
  status: i % 3 === 0 ? "停用" : "启用",
  email: `user${i + 1}@example.com`,
  department: departments[i % departments.length]!,
  city: cities[i % cities.length]!,
  amount: Math.round(((i + 1) * 937.5 + i * 13) * 100) / 100,
  score: 60 + ((i * 7) % 40),
  joinDate: new Date(2021, i % 12, (i % 28) + 1),
  updatedAt: new Date(2026, i % 11, ((i * 3) % 28) + 1, i % 24, i % 60),
}));

const search = defineForm<{ keyword: string; status: string | null }>({
  items: [
    {
      key: "keyword",
      title: "关键词",
      default: "",
      render: (r) => r.input({ placeholder: "姓名 / 角色 / 邮箱 / 部门" }),
    },
    {
      key: "status",
      title: "状态",
      default: null,
      render: (r) => r.select({ items: ["启用", "停用"] }),
    },
  ],
});

const table = defineTable<Row>({
  rowKey: "id",
  search,
  pageSize: 20,
  columns: [
    // fixed 列须同时给数字 width,否则 DEV 警告并按普通列渲染
    { key: "id", title: "ID", width: 80, fixed: "left" },
    { key: "name", title: "姓名", width: 100, fixed: "left" },
    { key: "role", title: "角色", width: 90 },
    {
      key: "status",
      title: "状态",
      width: 90,
      render: (r) =>
        r.dict({
          启用: { label: "启用", variant: "secondary" },
          停用: { label: "停用", variant: "outline" },
        }),
    },
    { key: "email", title: "邮箱", width: 200, ellipsis: "tooltip" },
    { key: "department", title: "所属部门", width: 120 },
    { key: "city", title: "城市", width: 90 },
    { key: "amount", title: "账户余额", width: 130, align: "right", render: (r) => r.currency() },
    { key: "score", title: "绩效评分", width: 100, align: "right" },
    { key: "joinDate", title: "入职日期", width: 120, render: (r) => r.date() },
    { key: "updatedAt", title: "最后更新", width: 160, render: (r) => r.date("yyyy-MM-dd HH:mm") },
    {
      key: "actions",
      title: "操作",
      width: 120,
      fixed: "right",
      render: (r) => r.button(["编辑", "删除"]),
    },
  ],
  // 服务端模式模拟:onLoad 拿当前表单值(form)与分页状态(page)查"库"
  onLoad: async ({ form, page, update }) => {
    const keyword = form.keyword.trim();
    const hit = (value: string) => value.includes(keyword);
    const filtered = rows.filter(
      (row) =>
        (!keyword || hit(row.name) || hit(row.role) || hit(row.email) || hit(row.department)) &&
        (!form.status || row.status === form.status),
    );
    const start = (page.pageIndex - 1) * page.pageSize;
    update(filtered.slice(start, start + page.pageSize), filtered.length);
  },
});

// 查询链路(R30):submit() 返回校验是否通过,通过才归位第 1 页重载
async function onSearch() {
  if (await table.search?.submit()) table.reload(true);
}

// 重置即回 items.default 后重载
function onReset() {
  table.search?.resetToDefaults();
  table.reload(true);
}
</script>

<template>
  <PageContainer layout="table">
    <template #form>
      <div class="flex flex-col gap-3">
        <FormRender v-if="table.search" :definition="table.search" :min-width="200" />
        <Button class="w-full" @click="onSearch">查 询</Button>
        <Button class="w-full" variant="outline" @click="onReset">重 置</Button>
      </div>
    </template>

    <TableRender :definition="table" row-key="id" :show-search="false" :show-pagination="false" />

    <template #pagination>
      <TablePagination :definition="table" class="w-full" nav-mode="icon" />
    </template>
  </PageContainer>
</template>
