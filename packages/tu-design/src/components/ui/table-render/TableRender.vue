<script setup lang="ts">
import type { ComponentPublicInstance, PropType, VNodeChild } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { columnRenders } from "./column-renders";
import { computed, inject, onMounted, ref, watch } from "vue";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { FormRender, type FormRenderDefinition } from "../../../components/ui/form-render";
import { Popover } from "../../../components/ui/popover";
import { Separator } from "../../../components/ui/separator";
import { Skeleton } from "../../../components/ui/skeleton";
import { Tooltip } from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";
import { PAGE_TABLE_FILL_KEY, SELECTION_CELL } from "./constants";
import { stickyClass, stickyStyle, type StickyMap } from "./sticky";
import TableBodyRow from "./TableBodyRow.vue";
import TablePagination from "./TablePagination.vue";
import type {
  ColumnVisibilityOptions,
  DataRecord,
  SortableOptions,
  TableBodyLine,
  TableColumnOptions,
  TableLoadParams,
  TableRenderDefinition,
  TableSelectionOptions,
  TreeOptions,
} from "./types";
import { useTableRender } from "./useTableRender";

// boolean flags 用运行时声明 + default: undefined 禁用 Vue 的 Boolean casting
// （casting 会让未传的 prop 变 false；Checkbox/Dialog/FormRender 同款约定）
const props = defineProps({
  /** 聚合式（推荐）：defineTable 返回的定义对象 */
  definition: { type: Object as PropType<TableRenderDefinition<any>> },
  /** 数据主键（记录缺字段时以行索引兜底） */
  rowKey: { type: String, required: true },
  /** 拆分式：与 definition 二选一，definition 优先 */
  columns: { type: Array as PropType<TableColumnOptions[]> },
  onLoad: {
    type: Function as PropType<(params: TableLoadParams) => void | Promise<unknown>>,
  },
  data: { type: Array as PropType<DataRecord[]> },
  autoLoad: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 每页条数 / 受控每页条数（D11）：传入即受控（pageIndex 未受控时 R9 归位内部处理并通知） */
  pageSize: { type: Number },
  pageSizeOpts: { type: Array as PropType<number[]> },
  loading: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  emptyText: { type: String },
  /** 行选择（仅拆分式生效；聚合式请在 defineTable 配置）："radio" | "checkbox" | 对象 */
  rowSelection: {
    type: [String, Object] as PropType<"radio" | "checkbox" | TableSelectionOptions>,
    default: undefined,
  },
  /** 搜索表单（defineForm 返回值）：拆分式直接传；聚合式请在 defineTable 配置（definition 优先，同传 DEV 警告） */
  search: { type: Object as PropType<FormRenderDefinition<any>> },
  /** 虚拟滚动：开启后表体行虚拟化渲染；聚合式请在 defineTable 配置（definition 优先）；须同时给 height */
  virtual: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 虚拟滚动容器高度（数字 px 或 CSS 高度）；仅 virtual: true 时生效 */
  height: { type: [Number, String] as PropType<number | string> },
  /** 树形数据（子行展开/收起）；拆分式直接传，聚合式请在 defineTable 配置 */
  tree: { type: Object as PropType<TreeOptions> },
  /** 受控页码（1-based）：传入即受控，缺省非受控；内部翻页经 update:page-index 通知 */
  pageIndex: { type: Number },
  /** 受控排序：传入即受控；内部/外部变化均经 sort-change 通知 */
  sort: { type: Object as PropType<SortableOptions> },
  /** 受控选中集（数组，与 update:selected-keys 载荷同构）：传入即受控 */
  selectedKeys: { type: Array as PropType<Array<string | number>> },
  /** 受控可见列 key（columns 原序子集）：传入即受控；内部显隐经 update:visible-keys 通知 */
  visibleKeys: { type: Array as PropType<string[]> },
  /** 拆分式默认可见列集；与聚合式 columnVisibility.defaultVisibleKeys 同传时 DEV 警告（R26，definition 优先） */
  defaultVisibleKeys: { type: Array as PropType<string[]> },
  /** 列设置触发器/面板开关（默认 true）；false 时不渲染 UI，受控 API 不受影响 */
  columnSettings: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 搜索区渲染开关（R27）：false 关闭内置搜索区（组合式外置 FormRender）；数据链路不变 */
  showSearch: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 分页条渲染开关（R28）：false 关闭内置分页条（组合式外置 TablePagination）；缺省模式 R13 不变 */
  showPagination: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  /** 填充模式：根容器 h-full 纵向 flex，滚动区 flex-1 内滚；表头 sticky 钉住。
   * 父链需有确定高度（如页面布局的 .table-body）；无确定高度时安全退化为自然高度。
   * 显式 prop 优先于布局 provide（key: "tu-design:page-table-fill"）；显式传 false 可强制关闭。
   * 纯布局属性，不进 defineTable/definition（virtual/height 例外），setup 期定版不支持运行时切换。 */
  fillHeight: { type: Boolean as PropType<boolean | undefined>, default: undefined },
});

// ---- 填充模式（fillHeight）---------------------------------------------------
// 布局上下文：页面布局容器 provide 同名 key，slot 内 TableRender 自动 fill。
// 字符串 key 跨包约定（常量 PAGE_TABLE_FILL_KEY 已导出，消费方零依赖时按字符串值 provide），
// setup 期定版，不支持运行时切换（与 virtual/search 同约定）。
const pageTableFill = inject<boolean>(PAGE_TABLE_FILL_KEY, false);
const fill = props.fillHeight ?? pageTableFill;

const emit = defineEmits<{
  "update:page-index": [pageIndex: number];
  "update:page-size": [pageSize: number];
  "sort-change": [sort: SortableOptions | undefined];
  "row-click": [record: DataRecord, index: number, event: MouseEvent];
  /** 行双击（与 row-click 独立，双击会先后触发 click 两次，属预期） */
  "row-dblclick": [record: DataRecord, index: number, event: MouseEvent];
  /** 行右键；不主动 preventDefault */
  "row-contextmenu": [record: DataRecord, index: number, event: MouseEvent];
  /** 单元格点击（columnKey 定位列）；冒泡并存——cell-click 触发时 row-click 也会触发 */
  "cell-click": [record: DataRecord, columnKey: string, index: number, event: MouseEvent];
  "selection-change": [rows: DataRecord[]];
  "update:selected-keys": [keys: Array<string | number>];
  /** 搜索：FormRender 校验通过后触发；载荷为当前表单值 */
  search: [values: DataRecord];
  /** 重置：FormRender 已重置为 defaults 后触发；载荷为重置后的表单值 */
  reset: [values: DataRecord];
  /** 服务端模式 onLoad 抛错/ rejects 时触发；下一次 load 开始时 error 投影清除 */
  "load-error": [error: Error];
  /** 可见列变化（受控回写通知 / v-model:visible-keys） */
  "update:visible-keys": [keys: string[]];
  /** 列显隐变化（受控/非受控均触发，供业务持久化；载荷 = 可见列 key 有序数组，columns 原序） */
  "column-visibility-change": [keys: string[]];
}>();

defineSlots<{
  empty?: () => VNodeChild;
  /** 错误态占位（服务端模式 onLoad 失败时渲染，优先于数据区） */
  error?: (props: { error: Error | undefined; retry: () => void }) => VNodeChild;
}>();

/** 加载态骨架行数（R14） */
const SKELETON_ROWS = [1, 2, 3, 4, 5];

/** 内置渲染器单例：render 工厂按列求值时复用（工厂本身轻量，仅为整洁） */
const RENDERS = columnRenders();

// 聚合式直接复用 defineTable 建好的内核；拆分式在本组件 setup 内建内核
// （TanStack useVueTable 只能在 setup 调用，故不能放进条件分支深处）
if (props.definition && props.columns && import.meta.env.DEV) {
  console.warn("[tu-design] <TableRender> definition 与 columns 同时传入，已按 definition 渲染。");
}
if (props.definition && props.rowSelection && import.meta.env.DEV) {
  console.warn(
    "[tu-design] <TableRender> 聚合式下 rowSelection 请在 defineTable 配置，组件 prop 已忽略。",
  );
}
const instance =
  props.definition ??
  useTableRender({
    columns: props.columns ?? [],
    onLoad: props.onLoad,
    data: () => props.data,
    autoLoad: props.autoLoad,
    pageSizeOpts: props.pageSizeOpts,
    rowKey: props.rowKey,
    rowSelection: props.rowSelection,
    search: props.search,
    virtual: props.virtual,
    height: props.height,
    tree: props.tree,
    pageIndex: () => props.pageIndex,
    pageSize: () => props.pageSize,
    sort: () => props.sort,
    selectedKeys: () => props.selectedKeys,
    columnVisibility: props.definition?.columnVisibility,
    defaultVisibleKeys: () => props.defaultVisibleKeys,
    visibleKeys: () => props.visibleKeys,
  });
// 拆分式已传 rowKey；聚合式由组件回填（S1：选择引擎依赖 rowKey 就绪）
instance.setRowKey(props.rowKey);

// ---- 搜索表单（FormRender 联动） --------------------------------------------
// 与 rowSelection 不同：聚合式下 prop 未被 definition 覆盖时回填引擎（不做聚合式忽略限制）；
// definition 与 prop 二选一，definition 优先，同传 DEV 警告
if (props.definition && props.search) {
  if (instance.search && import.meta.env.DEV) {
    console.warn(
      "[tu-design] <TableRender> 聚合式下 search 已在 defineTable 配置，组件 prop 已忽略。",
    );
  } else {
    instance.setSearch(props.search);
  }
}
// search 不支持运行时切换（与 FormRender definition/form 同款约定），setup 期定版即可
const search = instance.search;

// 列设置触发器的 Tooltip 受控开合（Tooltip 与 Popover 触发器嵌套会吞点击，故手动控制、不嵌套触发器）
const settingsTipOpen = ref(false);

// ---- 列显隐（column visibility，R20–R26） ------------------------------------
// R26：聚合式（columnVisibility.defaultVisibleKeys 经引擎解析回传）与拆分式 prop 同传 → definition 优先。
// 引擎是唯一解析点；聚合式受控回填经 setVisibleKeys（normalize 等值守卫防回弹）；
// 拆分式由引擎受控 watch 直接同步（源 = props getter）
if (
  props.definition &&
  instance.defaultVisibleKeys !== undefined &&
  props.defaultVisibleKeys !== undefined &&
  import.meta.env.DEV
) {
  console.warn(
    "[tu-design] <TableRender> 聚合式下 defaultVisibleKeys 已在 columnVisibility 配置，组件 prop 已忽略。",
  );
}
watch(
  () => props.visibleKeys,
  (next) => {
    if (props.definition && next !== undefined) instance.setVisibleKeys(next);
  },
  { immediate: true },
);

/**
 * 当前搜索表单值快照（浅拷贝；无 search 时为空对象）
 * @returns 表单值快照
 */
function searchValues(): DataRecord {
  return search ? { ...search.form.state.values } : {};
}

/** 搜索：校验已由 FormRender 完成；归位第 1 页重载，分页/排序取数自动携带最新表单值 */
function onSearch() {
  emit("search", searchValues());
  instance.reload(true);
}

/** 重置：FormRender 已同步重置为 defaults（TanStack reset 为同步 setState），此刻读取即 defaults */
function onReset() {
  emit("reset", searchValues());
  instance.reload(true);
}

const columns = computed(() => instance.columns);
const rows = computed(() => instance.table.getRowModel().rows);
/** 内部加载态 ∪ 外部受控加载态（R14） */
const loading = computed(() => props.loading === true || instance.loading.value);
const showPagination = computed(() => Math.ceil(instance.page.total / instance.page.pageSize) > 1);
/** 内置分页条开关（R28）：showPagination=false 关闭；R13 仅作用于缺省模式 */
const showPaginationBar = computed(() => showPagination.value && props.showPagination !== false);
/** 内置搜索区开关（R27）：配置了 search 且未被 showSearch=false 关闭；列设置触发器不受影响 */
const showSearchArea = computed(() => search !== undefined && props.showSearch !== false);

// ---- 错误态（服务端模式 onLoad 失败） ----------------------------------------
// loading 判定优先；error 优先于正常数据（load 开始时引擎已清除旧错误，loading 期间 error 恒空）
const loadError = computed(() => instance.error.value);
const showError = computed(() => !loading.value && loadError.value !== undefined);

watch(loadError, (err) => {
  if (err) emit("load-error", err);
});

function retry() {
  instance.reload();
}

// ---- 行选择（S 系列） -------------------------------------------------------
const selection = computed(() => instance.selection);
const selectedKeys = instance.selectedKeys;
const hasSelection = computed(() => selection.value.enabled);

// ---- 列显隐（column visibility，R20–R26） -------------------------------------
const visibleKeySet = computed(() => new Set(instance.visibleKeys.value));
/** 可见业务列（columns 原序子集）：header/body/骨架/colspan/sticky 全部基于此渲染（R23/R25） */
const visibleColumns = computed(() =>
  columns.value.filter((column) => visibleKeySet.value.has(column.key)),
);
/** 列设置触发器/面板开关（默认 true）；false 时不渲染 UI，受控 API 不受影响 */
const showColumnSettings = computed(() => props.columnSettings ?? true);

function isColumnVisible(key: string): boolean {
  return visibleKeySet.value.has(key);
}

/**
 * 最少一列（R20）：唯一可见列不可隐藏
 * @param key - 列 key
 * @returns 是否允许隐藏该列
 */
function canHideColumn(key: string): boolean {
  return !(instance.visibleKeys.value.length <= 1 && visibleKeySet.value.has(key));
}

function toggleColumnVisible(key: string) {
  if (!canHideColumn(key)) return;
  instance.setVisibleKeys(
    isColumnVisible(key)
      ? instance.visibleKeys.value.filter((k) => k !== key)
      : [...instance.visibleKeys.value, key],
  );
}

const allColumnsVisible = computed(
  () => columns.value.length > 0 && visibleColumns.value.length === columns.value.length,
);

function selectAllColumns() {
  if (allColumnsVisible.value) return;
  instance.setVisibleKeys(columns.value.map((column) => column.key));
}

function resetColumns() {
  // R21：恢复 defaultVisibleKeys；未配置 = 全部可见
  instance.setVisibleKeys(instance.defaultVisibleKeys ?? columns.value.map((column) => column.key));
}

// 受控/非受控均通知：统一投影变化 → 双事件（载荷 = columns 原序可见 key）
watch(instance.visibleKeys, (keys) => {
  emit("update:visible-keys", [...keys]);
  emit("column-visibility-change", [...keys]);
});

/** 总列数 = 可见业务列 + 选择列（空态 colspan 与骨架行，S8/R23） */
const columnCount = computed(() => visibleColumns.value.length + (hasSelection.value ? 1 : 0));

// ---- 固定列（sticky） --------------------------------------------------------

// DEV 校验：sticky 偏移只能从数字 width（px）推算，否则降级普通列（columns setup 期定版，只查一次）
for (const column of columns.value) {
  if (column.fixed !== undefined && typeof column.width !== "number") {
    console.warn(
      `[tu-design] <TableRender> fixed 列 "${column.key}" 需要数字 width，已忽略 fixed。`,
    );
  }
}

// DEV 提示（一次性，columns setup 期定版，R32）：多列宽表全列无数字 width 时，
// min-width 横滚不可达 —— 宽表请为列声明数字 width（px）。
if (columns.value.length >= 10 && !columns.value.some((c) => typeof c.width === "number")) {
  console.warn(
    `[tu-design] <TableRender> ${columns.value.length} 列均无数字 width，` +
      `窄容器下不会出现横向滚动（R32）；宽表请为列声明数字 width（px）。`,
  );
}

/** sticky 单元格映射（纯渲染层 computed，不进 TanStack pinning state）：
 * 选择列视作最左 fixed 列参与累计（offset 0）；fixed-left 按列序累加，
 * fixed-right 从最右列反向累计。edge = 该 sticky 组朝滚动方向的交界列（加分隔边框）。
 * 全部基于**可见集**（R23）：sticky 组因隐藏变空则无该组输出（不输出边框）。
 */
const stickyOf = computed<StickyMap>(() => {
  const map: StickyMap = new Map();
  // instance.columns 是联合数组（聚合式 any / 拆分式 DataRecord），联合上的 filter
  // 类型谓词重载解析不可靠，故 map 提取时以断言收窄 width（条件已含 typeof 守卫）
  const lefts = visibleColumns.value
    .filter((column) => column.fixed === "left" && typeof column.width === "number")
    .map((column) => ({ key: column.key, width: column.width as number }));
  const rights = visibleColumns.value
    .filter((column) => column.fixed === "right" && typeof column.width === "number")
    .map((column) => ({ key: column.key, width: column.width as number }));

  let acc = 0;
  if (hasSelection.value) {
    map.set(SELECTION_CELL, { side: "left", offset: 0, edge: lefts.length === 0 });
    acc = selection.value.width;
  }
  lefts.forEach((left, index) => {
    map.set(left.key, { side: "left", offset: acc, edge: index === lefts.length - 1 });
    acc += left.width;
  });

  let racc = 0;
  for (let index = rights.length - 1; index >= 0; index--) {
    const right = rights[index]!;
    map.set(right.key, { side: "right", offset: racc, edge: index === 0 });
    racc += right.width;
  }
  return map;
});

// ---- 表格 min-width（列宽硬约束，R32） ----------------------------------------
// 可见业务列数字 width 之和（含选择列）作为 <table> min-width 下限：
// 容器不足 → 表格被顶到 Σwidth，auto 布局下列渲染宽度 == 指定宽度，stickyOf 偏移精确成立，
// 滚动区 overflow-x-auto 横滚；容器充足 → 表格仍 100% 拉伸（有宽列可能被拉伸，
// sticky 偏移按指定值累计的漂移为既有限制，非 R32 引入）。
// 字符串 width 仅渲染提示值，不参与求和（与 stickyOf 口径一致）；和为 0 不挂 style（零回归）。
const tableMinWidth = computed(() => {
  let sum = 0;
  for (const column of visibleColumns.value) {
    if (typeof column.width === "number" && column.width > 0) sum += column.width;
  }
  if (hasSelection.value && selection.value.width > 0) sum += selection.value.width;
  return sum;
});

/** 列宽 inline style 值（R33）：数字补 px 单位——Vue :style 不自动加单位，
 * 裸数字会被浏览器当非法 CSS 值丢弃，列宽即失效；字符串视为已带单位原样输出。
 * @param width - 列宽配置
 * @returns 可直接用于 :style 的 CSS 宽度值；未配置返回 undefined
 */
function widthOf(width?: number | string) {
  return typeof width === "number" ? `${width}px` : width;
}

/** 表头全选三态（S10）：本页可选行与选中集求交派生（TanStack getter 追踪不稳，自算） */
const selectableKeys = computed(() =>
  rows.value.filter((row) => row.getCanSelect()).map((row) => rowKeyOf(row.original, row.index)),
);
const headerChecked = computed(
  () =>
    hasSelection.value &&
    selection.value.type === "checkbox" &&
    selectableKeys.value.length > 0 &&
    selectableKeys.value.every((key) => selectedKeys.value.has(key)),
);
const headerIndeterminate = computed(
  () =>
    hasSelection.value &&
    !headerChecked.value &&
    selectableKeys.value.some((key) => selectedKeys.value.has(key)),
);

function onHeaderSelect(checked: boolean) {
  instance.table.toggleAllPageRowsSelected(checked);
}

/**
 * 行选择控件切换；radio 不可取消由引擎 S4 守卫，不选中态点击传 checked=true
 * @param line - 行数据（含行 key）
 * @param checked - 目标选中态
 */
function onRowSelect(line: { key: string }, checked: boolean) {
  instance.toggleRowSelected(line.key, checked);
}

// 选中集变化 → 对外事件（S7）：排序/翻页不改变选中集，故不会误发
watch(instance.selectedKeys, (keys) => {
  emit("selection-change", [...selection.value.value]);
  emit("update:selected-keys", [...keys]);
});

/** 行 → 单元格值矩阵：render > formatter > record[key]（R17） */
const body = computed<TableBodyLine[]>(() => {
  // 渲染器工厂按列求值一次（而非每单元格），避免用户工厂内的重分配被放大
  const renderFns = new Map(
    columns.value.filter((c) => c.render).map((c) => [c, c.render!(RENDERS)]),
  );
  return rows.value.map((row) => ({
    /** TanStack Row：树形渲染读 depth / getCanExpand / getIsExpanded / toggleExpanded */
    row,
    key: rowKeyOf(row.original, row.index),
    index: row.index,
    record: row.original,
    /** 行级可选过滤（S5）：selectable 谓词交由引擎 enableRowSelection 判定 */
    canSelect: row.getCanSelect(),
    // 可见列的值矩阵（列显隐只裁剪列；R25 状态不受影响）
    cells: visibleColumns.value.map((column): VNodeChild => {
      const render = renderFns.get(column);
      if (render) return render(row.original, row.index, column);
      if (column.formatter) return column.formatter(row.original) as VNodeChild;
      return String(row.original[column.key] ?? "");
    }),
  }));
});

// ---- 树形数据（T 系列） ------------------------------------------------------
// 引擎是唯一解析点（无效配置已 warn 并忽略，回传 undefined）；tree 为 undefined 时不渲染缩进与 caret
const tree = instance.tree;
const treeIndent = tree?.indentSize ?? 16;

let missingRowKeyWarned = false;

/**
 * 行主键：rowKey 字段缺失时以行索引兜底（R3）
 * @param record - 行记录
 * @param index - 行索引（兜底来源）
 * @returns 稳定的行主键字符串
 */
function rowKeyOf(record: DataRecord, index: number): string {
  const value = record[props.rowKey];
  if (value === undefined || value === null) {
    if (!missingRowKeyWarned && import.meta.env.DEV) {
      missingRowKeyWarned = true;
      console.warn(
        `[tu-design] <TableRender> 部分记录缺少 rowKey 字段 "${props.rowKey}"，已退化为按行索引标识。`,
      );
    }
    return `index-${index}`;
  }
  return String(value);
}

// ---- 虚拟滚动 / 填充模式 ------------------------------------------------------
// definition 优先于 prop（配置定版，不支持运行时切换）
const virtualRaw = instance.virtual ?? props.virtual;
const heightRaw = instance.height ?? props.height;
// fill 模式自带真实滚动盒（flex-1 实测高度），virtual 无需显式 height
if (virtualRaw === true && heightRaw === undefined && !fill) {
  console.warn("[tu-design] <TableRender> virtual 需要配置 height，已降级普通渲染。");
}
const virtualEnabled = virtualRaw === true && (heightRaw !== undefined || fill);
const scrollHeight = computed(() => (typeof heightRaw === "number" ? `${heightRaw}px` : heightRaw));
/** 表头 sticky 仅在组件内存在真实纵向滚动盒时生效（fill / virtual），普通模式不挂载，行为不变 */
const theadSticky = fill || virtualEnabled;
/** 滚动区样式：virtual 用固定 height；fill 交给 flex 分配（二者同传以 fill 优先） */
const scrollStyle = computed(() => {
  if (fill || !virtualEnabled) return undefined;
  return { height: scrollHeight.value, overflowY: "auto" as const };
});
/** sticky 表头普通列类：不透明底防行内容透出；分隔线归 th（thead 行级 border 会随行滚走）；
 * z-20 高于表体 fixed 列（--z-sticky: 10），纵向滚动行滑过表头时不穿透；
 * 表头 fixed 列的 z 由 stickyStyle inline style（var(--z-sticky-head)）提供，inline 优先级天然覆盖此处 class */
const theadThClass = theadSticky ? "sticky top-0 z-20 border-b border-border bg-background" : "";
/** sticky 态 table 改分离边框：preflight 为 border-collapse: collapse，
 * 折叠边框几何归属 table，Chrome 下 sticky th 粘住后自身 border-b 渲染丢失；
 * separate + spacing-0 恢复单元格边框。普通模式保持 collapse，零回归。 */
const tableClass = theadSticky ? "border-separate border-spacing-0" : "";

const scrollEl = ref<HTMLElement | null>(null);
const theadEl = ref<HTMLElement | null>(null);
/** 滚动容器内 thead 占据的前缀高度（scrollMargin）；表头内容静态，挂载后测量一次 */
const theadOffset = ref(0);

// 仅 virtual: true 且 height 就绪时创建（配置 setup 期定版，顶层条件分支可安全注册生命周期）
const virtualizerRef = virtualEnabled
  ? useVirtualizer(
      computed(() => ({
        count: rows.value.length, // 翻页/重载后行窗口变化 → options 更新（setOptions 自动生效）
        getScrollElement: () => scrollEl.value,
        estimateSize: () => 40,
        overscan: 8,
        getItemKey: (index: number) => rowKeyOf(rows.value[index]!, index), // rowKey 作为虚拟行 key
        scrollMargin: theadOffset.value, // thead 在滚动容器内的 offset 前缀
      })),
    )
  : null;

onMounted(() => {
  if (virtualEnabled) theadOffset.value = theadEl.value?.offsetHeight ?? 0;
});

const virtualRows = computed(() => (virtualizerRef ? virtualizerRef.value.getVirtualItems() : []));
const virtualTotal = computed(() => (virtualizerRef ? virtualizerRef.value.getTotalSize() : 0));
/** 窗口行 + 对应全量行数据（cells 矩阵已由 body computed 缓存，虚拟化只裁剪 DOM 节点） */
const virtualLines = computed(() =>
  virtualRows.value.map((row) => ({ row, line: body.value[row.index]! })),
);
const padTop = computed(() => virtualRows.value[0]?.start ?? 0);
const padBottom = computed(() => {
  const items = virtualRows.value;
  return items.length === 0 ? 0 : Math.max(0, virtualTotal.value - items[items.length - 1]!.end);
});

/** 行高动态测量：measureElement 读 data-index 把实测高度写回（行内容高度可变，不假设固定行高）。
 * 行组件为函数 ref，拿到的是组件实例，需经 $el 取真实 tr。
 * @param node - 函数 ref 收到的行元素或组件实例
 */
function measureRow(node: Element | ComponentPublicInstance | null) {
  const el = node instanceof Element ? node : (node?.$el as Element | undefined);
  if (el instanceof Element) virtualizerRef?.value.measureElement(el);
}

/**
 * aria-sort 仅在该列当前被排序时标注（R16）
 * @param column - 列配置
 * @returns 当前排序方向对应的 aria-sort 值；未排序返回 undefined
 */
function ariaSort(column: TableColumnOptions): "ascending" | "descending" | undefined {
  if (instance.sort.value?.key !== column.key) return undefined;
  return instance.sort.value.direction === "asc" ? "ascending" : "descending";
}

function sortMark(column: TableColumnOptions): string {
  const direction = instance.sort.value?.key === column.key ? instance.sort.value.direction : "";
  return direction === "asc" ? "↑" : direction === "desc" ? "↓" : "";
}

function onSort(key: string) {
  instance.toggleSort(key);
  emit("sort-change", instance.sort.value);
}

function onPageIndex(pageIndex: number) {
  instance.setPageIndex(pageIndex);
  lastEmittedPage.pageIndex = pageIndex;
  emit("update:page-index", pageIndex);
}

function onPageSize(pageSize: number) {
  instance.setPageSize(pageSize);
  lastEmittedPage.pageSize = pageSize;
  emit("update:page-size", pageSize);
}

// ---- 受控模式（v-model）：page 投影 → update:* 通知 ---------------------------
// 仅 page-index/page-size 至少一方受控时安装；lastEmittedPage 去重——
// 动作路径已 emit 过的值不再重复发（受控回写/内部归位只通知「未通知过的」变化）
const pageControlled = () => props.pageIndex !== undefined || props.pageSize !== undefined;
const lastEmittedPage = {
  pageIndex: undefined as number | undefined,
  pageSize: undefined as number | undefined,
};

if (pageControlled()) {
  watch(
    () => [instance.page.pageIndex, instance.page.pageSize] as const,
    ([pageIndex, pageSize]) => {
      if (pageIndex !== lastEmittedPage.pageIndex) {
        lastEmittedPage.pageIndex = pageIndex;
        emit("update:page-index", pageIndex);
      }
      if (pageSize !== lastEmittedPage.pageSize) {
        lastEmittedPage.pageSize = pageSize;
        emit("update:page-size", pageSize);
      }
    },
  );
}

function onRowClick(record: DataRecord, index: number, event: MouseEvent) {
  emit("row-click", record, index, event);
}

function onRowDblclick(record: DataRecord, index: number, event: MouseEvent) {
  emit("row-dblclick", record, index, event);
}

function onRowContextmenu(record: DataRecord, index: number, event: MouseEvent) {
  emit("row-contextmenu", record, index, event);
}

function onCellClick(record: DataRecord, columnKey: string, index: number, event: MouseEvent) {
  emit("cell-click", record, columnKey, index, event);
}

defineExpose({
  table: instance.table,
  page: instance.page,
  sort: instance.sort,
  loading: instance.loading,
  error: instance.error,
  visibleKeys: instance.visibleKeys,
  setVisibleKeys: instance.setVisibleKeys,
  reload: instance.reload,
  toggleSort: onSort,
  setPageIndex: onPageIndex,
  setPageSize: onPageSize,
  selection: instance.selection,
  selectedKeys: instance.selectedKeys,
  setSelection: instance.setSelection,
  clearSelection: instance.clearSelection,
});
</script>

<template>
  <div :class="cn('w-full', fill && 'flex h-full min-h-0 flex-col', $attrs.class)">
    <!-- 搜索区 + 列设置触发器：同行右对齐（items-end）；无搜索时触发器位于表格上方（R27：showSearch=false 关闭搜索区） -->
    <div
      v-if="showSearchArea || showColumnSettings"
      :class="cn('mb-2 flex items-end justify-between gap-2', fill && 'shrink-0')"
    >
      <FormRender
        v-if="showSearchArea"
        class="min-w-0 flex-1"
        :definition="search"
        :searchable="search.actions ? undefined : true"
        @search="onSearch"
        @reset="onReset"
      />

      <!-- 列设置：Popover 面板（R20 最少一列 / R21 重置 / R22 不含选择列）；
           触发钮 Tooltip 手动受控开合（Tooltip 与 Popover 触发器嵌套会吞点击，故并列渲染、不走 hover 自动触发） -->
      <template v-if="showColumnSettings">
        <Popover align="end" content-class="w-56 p-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="列设置"
            aria-haspopup="true"
            @pointerenter="settingsTipOpen = true"
            @pointerleave="settingsTipOpen = false"
          >
            <!-- lucide Settings2（内联 SVG，跟随项目图标现状） -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4"
              aria-hidden="true"
            >
              <path d="M20 7h-9" />
              <path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" />
              <circle cx="7" cy="7" r="3" />
            </svg>
          </Button>
          <template #content>
            <div class="flex items-center justify-end gap-3 px-3 py-2">
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="allColumnsVisible"
                @click="selectAllColumns"
              >
                全选
              </button>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                @click="resetColumns"
              >
                重置
              </button>
            </div>
            <Separator />
            <div class="max-h-64 overflow-y-auto py-1">
              <div
                v-for="column in columns"
                :key="column.key"
                data-column-item
                :data-column-key="column.key"
                class="hover:bg-accent/50 flex h-8 cursor-pointer items-center gap-2 px-3"
                @click="toggleColumnVisible(column.key)"
              >
                <Checkbox
                  :checked="isColumnVisible(column.key)"
                  :disabled="!canHideColumn(column.key)"
                  @update:checked="toggleColumnVisible(column.key)"
                  @click.stop
                />
                <span class="min-w-0 flex-1 truncate">{{ column.title }}</span>
                <!-- 有效 fixed 列（数字 width）标识 -->
                <svg
                  v-if="column.fixed !== undefined && typeof column.width === 'number'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-muted-foreground size-3 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M12 17v5" />
                  <path
                    d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"
                  />
                </svg>
              </div>
            </div>
          </template>
        </Popover>
        <!-- 纯受控气泡（无默认插槽，不渲染触发器）：开合由触发钮 pointerenter/leave 驱动 -->
        <Tooltip :open="settingsTipOpen" content="列设置" />
      </template>
    </div>

    <!-- 滚动容器：横向滚动时 fixed 列 sticky 生效；virtual/fill 模式兼任纵向滚动（分页条不参与滚动） -->
    <div
      ref="scrollEl"
      :class="cn('overflow-x-auto', fill && 'min-h-0 flex-1 overflow-y-auto')"
      :style="scrollStyle"
    >
      <table
        class="w-full caption-bottom text-sm"
        :class="tableClass"
        :style="tableMinWidth > 0 ? { minWidth: `${tableMinWidth}px` } : undefined"
      >
        <thead ref="theadEl" :class="theadSticky ? undefined : '[&_tr]:border-b'">
          <tr>
            <!-- 选择列：checkbox 型表头为本页全选三态（S3/S10）；radio 型占位；视作最左固定列 -->
            <th
              v-if="hasSelection"
              scope="col"
              class="h-10 w-12 px-2 text-center align-middle font-medium text-muted-foreground"
              :class="[stickyClass(stickyOf, SELECTION_CELL), theadThClass]"
              :style="[
                { width: `${selection.width}px` },
                stickyStyle(stickyOf, SELECTION_CELL, true),
              ]"
            >
              <Checkbox
                v-if="selection.type === 'checkbox'"
                :checked="headerIndeterminate ? 'indeterminate' : headerChecked"
                :aria-label="'全选本页'"
                @update:checked="onHeaderSelect"
              />
            </th>
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              scope="col"
              class="h-10 px-2 align-middle font-medium text-muted-foreground"
              :class="[stickyClass(stickyOf, column.key), theadThClass]"
              :style="[
                { width: widthOf(column.width), textAlign: column.align ?? 'center' },
                stickyStyle(stickyOf, column.key, true),
              ]"
              :aria-sort="ariaSort(column)"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1 hover:text-foreground"
                @click="onSort(column.key)"
              >
                {{ column.title }}
                <span aria-hidden="true" class="text-xs">{{ sortMark(column) }}</span>
              </button>
              <template v-else>{{ column.title }}</template>
            </th>
          </tr>
        </thead>

        <tbody class="[&_tr:last-child]:border-0">
          <!-- 加载态：固定 5 行骨架（R14）；选择列一并占位（S8）；骨架不虚拟化；loading 判定优先 -->
          <template v-if="loading">
            <tr v-for="row in SKELETON_ROWS" :key="row" data-skeleton>
              <td
                v-if="hasSelection"
                class="p-2 text-center align-middle"
                :class="stickyClass(stickyOf, SELECTION_CELL)"
                :style="stickyStyle(stickyOf, SELECTION_CELL, false)"
              >
                <Skeleton class="size-4" />
              </td>
              <td
                v-for="column in visibleColumns"
                :key="column.key"
                class="p-2 align-middle"
                :class="stickyClass(stickyOf, column.key)"
                :style="[
                  { textAlign: column.align ?? 'center' },
                  stickyStyle(stickyOf, column.key, false),
                ]"
              >
                <Skeleton class="h-4 w-full" />
              </td>
            </tr>
          </template>

          <!-- 错误态：error 优先于正常数据；插槽可自定义（slot props { error, retry }） -->
          <template v-else-if="showError">
            <tr data-error>
              <td :colspan="columnCount" class="p-8 text-center text-muted-foreground">
                <slot name="error" :error="loadError" :retry="retry">
                  <div class="flex flex-col items-center gap-3">
                    <p>{{ loadError?.message ?? "加载失败" }}</p>
                    <Button variant="outline" size="sm" @click="retry">重试</Button>
                  </div>
                </slot>
              </td>
            </tr>
          </template>

          <!-- 虚拟滚动：窗口行 + 前后占位行（总高撑开滚动区间；行高经 measureElement 动态测量） -->
          <template v-else-if="virtualEnabled">
            <tr aria-hidden="true" data-virtual-pad :style="{ height: `${padTop}px` }">
              <td :colspan="columnCount" class="border-0 p-0"></td>
            </tr>
            <TableBodyRow
              v-for="item in virtualLines"
              :key="item.line.key"
              :ref="measureRow"
              :data-index="item.row.index"
              :line="item.line"
              :columns="visibleColumns"
              :selection="hasSelection ? selection.type : undefined"
              :selected="selectedKeys.has(item.line.key)"
              :sticky="stickyOf"
              :tree-indent="tree ? treeIndent : undefined"
              @select="(checked: boolean) => onRowSelect(item.line, checked)"
              @row-click="onRowClick(item.line.record, item.line.index, $event)"
              @row-dblclick="onRowDblclick(item.line.record, item.line.index, $event)"
              @row-contextmenu="onRowContextmenu(item.line.record, item.line.index, $event)"
              @cell-click="
                (columnKey: string, event: MouseEvent) =>
                  onCellClick(item.line.record, columnKey, item.line.index, event)
              "
            />
            <tr aria-hidden="true" data-virtual-pad :style="{ height: `${padBottom}px` }">
              <td :colspan="columnCount" class="border-0 p-0"></td>
            </tr>
          </template>

          <template v-else>
            <TableBodyRow
              v-for="line in body"
              :key="line.key"
              :line="line"
              :columns="visibleColumns"
              :selection="hasSelection ? selection.type : undefined"
              :selected="selectedKeys.has(line.key)"
              :sticky="stickyOf"
              :tree-indent="tree ? treeIndent : undefined"
              @select="(checked: boolean) => onRowSelect(line, checked)"
              @row-click="onRowClick(line.record, line.index, $event)"
              @row-dblclick="onRowDblclick(line.record, line.index, $event)"
              @row-contextmenu="onRowContextmenu(line.record, line.index, $event)"
              @cell-click="
                (columnKey: string, event: MouseEvent) =>
                  onCellClick(line.record, columnKey, line.index, event)
              "
            />
          </template>

          <!-- 空态：横跨全列的单单元格，不虚拟化；错误态优先 -->
          <tr v-if="!loading && !showError && body.length === 0" data-empty>
            <td :colspan="columnCount" class="p-8 text-center text-muted-foreground">
              <slot name="empty">{{ emptyText ?? "暂无数据" }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- R31：手动接线（须经 onPageIndex/onPageSize 包装器保留受控去重）；显式补 border-t 与 size select 保持现状 -->
    <TablePagination
      v-if="showPaginationBar"
      :class="cn('border-t', fill && 'shrink-0')"
      :page-index="instance.page.pageIndex"
      :page-size="instance.page.pageSize"
      :page-size-opts="instance.page.pageSizeOpts"
      :total="instance.page.total"
      :show-size-select="true"
      @update:page-index="onPageIndex"
      @update:page-size="onPageSize"
    />
  </div>
</template>
