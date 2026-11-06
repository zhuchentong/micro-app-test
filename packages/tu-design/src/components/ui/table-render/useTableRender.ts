import type { ColumnDef, RowSelectionState } from "@tanstack/vue-table";
import { computed, onMounted, reactive, readonly, ref, shallowRef, toValue, watch } from "vue";
import type { Ref } from "vue";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import type {
  DataRecord,
  SortableOptions,
  TableRenderDefinition,
  TableSelectionOptions,
  TreeOptions,
  UseTableRenderOptions,
} from "./types";
import type { FormRenderDefinition } from "../form-render";

const DEFAULT_PAGE_SIZE_OPTS = [10, 20, 50, 100];

/**
 * 数值配置防御：受控 getter（组件层）与数值配置（defineTable 层）同字段共存时只认数字
 * @param value - 待判定的配置值
 * @returns 值为数字时原样返回，否则返回 undefined
 */
function numericOption(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * DEV 兜底提示：生产构建静默，只留可读的降级行为（R1–R7）
 * @param message - 提示文本
 */
function warn(message: string) {
  if (import.meta.env.DEV) console.warn(`[tu-design] <TableRender> ${message}`);
}

/**
 * 表格数据内核：TanStack 无头引擎组装 + 1-based 对外投影 + 实例动作。
 *
 * 状态真相源是 TanStack 引擎（pageIndex 为 0-based），
 * `page`/`sort` 是对外的 1-based 只读投影，由 watch 同步。
 * @param options - 表格配置：列定义、数据源（静态 data 或服务端 onLoad）、分页排序、
 *   行选择、树形、列显隐、搜索表单等
 * @returns 表格渲染定义（含只读投影与实例动作），供 TableRender 组件消费
 */
export function useTableRender<T extends DataRecord>(
  options: UseTableRenderOptions<T>,
): TableRenderDefinition<T> {
  const columns = options.columns;
  // 传入 onLoad 即服务端模式：分页/排序交由数据源，引擎不做本地加工
  const serverMode = typeof options.onLoad === "function";

  if (columns.length === 0) warn("columns 为空，表格将没有表头。");
  if (serverMode && options.data !== undefined) {
    warn("onLoad 与 data 不能同时传入，已按 onLoad（服务端模式）处理。");
  }

  // ---- 受控模式（v-model，D11） ------------------------------------------------
  // 约定：options 字段传入（非 undefined）即受控；受控值经 watch 同步进 TanStack，
  // 内部交互仍走既有动作路径（emit 由组件负责）。等值守卫防「父回写 → 同步 → 回弹」循环。
  const controlledPageIndex = () => toValue(options.pageIndex);
  const controlledPageSize = () => toValue(options.pageSize);
  const controlledSort = () => toValue(options.sort);
  const controlledSelectedKeys = () => toValue(options.selectedKeys);
  const controlledVisibleKeys = () => toValue(options.visibleKeys);

  // ---- 树形数据（T 系列） ------------------------------------------------------
  // 唯一解析点：无效配置 warn 并忽略；解析结果回传供组件读取 indentSize
  let tree: TreeOptions | undefined;
  if (options.tree !== undefined) {
    if (typeof options.tree !== "object" || options.tree === null) {
      warn("tree 必须是对象配置，已忽略。");
    } else if (
      options.tree.childrenKey !== undefined &&
      typeof options.tree.childrenKey !== "string"
    ) {
      warn("tree.childrenKey 必须是字符串，已忽略。");
    } else {
      tree = options.tree;
    }
  }
  const childrenKey = tree?.childrenKey ?? "children";

  // ---- 搜索表单（FormRender 联动） -------------------------------------------
  // any：FormRenderDefinition 对 T 不变，DataRecord 版拒收具体 defineForm<Q> 结果（见 types.ts）
  let search: FormRenderDefinition<any> | undefined;

  /**
   * search 唯一装配入口：静态模式 / 缺 form·items 时 DEV 警告并忽略
   * @param next - 待装配的搜索表单定义，undefined 表示移除
   */
  function applySearch(next: FormRenderDefinition<any> | undefined) {
    if (next === undefined) {
      search = undefined;
      return;
    }
    if (!serverMode) {
      warn("search 仅服务端模式生效（未传 onLoad），已忽略。");
      search = undefined;
      return;
    }
    if (!next.form || !Array.isArray(next.items)) {
      warn("search 缺少 form 或 items，已忽略。");
      search = undefined;
      return;
    }
    search = next;
  }

  applySearch(options.search);

  /**
   * 拆分式/组件级装配口：definition 未配置 search 时由 TableRender 回填 prop（对齐 setRowKey）
   * @param next - 待回填的搜索表单定义
   */
  function setSearch(next: FormRenderDefinition<any> | undefined) {
    if (search || !next) return;
    applySearch(next);
  }

  const page = reactive({
    pageIndex: 1,
    pageSize: controlledPageSize() ?? numericOption(options.pageSize) ?? 10,
    total: 0,
    pageSizeOpts: options.pageSizeOpts ?? DEFAULT_PAGE_SIZE_OPTS,
  });
  // defaultSort：静态模式进 TanStack 初始 sorting，服务端模式进首载 sort 参数
  const defaults = columns.filter((column) => column.defaultSort !== undefined);
  if (defaults.length > 1) {
    warn(`多列 defaultSort 仅首列 "${defaults[0].key}" 生效，其余已忽略。`);
  }
  if (defaults[0] && defaults[0].sortable !== true) {
    warn(`列 "${defaults[0].key}" 的 defaultSort 需要同时开启 sortable，已忽略。`);
  }
  const sorted = defaults.find((column) => column.sortable === true);

  // 初始值合并：受控初值优先于 defaultSort / pageSize 配置（避免 mount 后二次跳转与重复 load）
  const initialSort = controlledSort();
  const sort = ref<SortableOptions | undefined>(
    initialSort ?? (sorted ? { key: sorted.key, direction: sorted.defaultSort! } : undefined),
  );
  const loading = ref(false);
  const error = ref<Error | undefined>(undefined);
  const rows = shallowRef<T[]>([]);

  // ---- 行选择（S 系列） ------------------------------------------------------
  // 字符串简写 → 对象（S2）
  const rawSelection = options.rowSelection;
  const selectionConfig: TableSelectionOptions<T> | undefined =
    rawSelection === undefined
      ? undefined
      : typeof rawSelection === "string"
        ? { type: rawSelection }
        : rawSelection;
  // rowKey 由 defineTable 配置或 TableRender setup 时回填（S1）；就绪前选择不可用
  const rowKey = ref(options.rowKey);
  const selectionEnabled = computed(() => selectionConfig !== undefined && !!rowKey.value);
  const selectedKeys = ref(new Set<string | number>()) as Ref<Set<string | number>>;
  const selectionRows = shallowRef<T[]>([]);
  /** key → 最近一次出现的行对象；跨页选中行由此返回快照（S6） */
  const selectionSnapshot = new Map<string, T>();
  /** 选中但当前数据中不存在的 key（reserveOnPageChange 语义，S12） */
  const dirtyKeys = new Set<string>();
  /** 受控选择状态：单一真相源，onRowSelectionChange 只通知不落盘（避免 setRowSelection 回环） */
  const rowSelectionState = ref<RowSelectionState>({});

  function selectionEmitSafe() {
    // 选择集变化 → 替换新 Set 触发依赖（S7）；rows 从快照解析（含跨页）
    const keys = new Set<string | number>();
    for (const key of Object.keys(rowSelectionState.value))
      if (rowSelectionState.value[key]) keys.add(key);
    selectedKeys.value = keys;
    selectionRows.value = [...keys].map(
      (key) => selectionSnapshot.get(String(key)) ?? ({ [rowKey.value!]: key } as T),
    );
  }

  /**
   * 选中集写入的唯一入口：赋受控 state + 重建对外投影
   * @param next - TanStack 行选择状态（row id → 是否选中）
   */
  function applyRowSelection(next: RowSelectionState) {
    rowSelectionState.value = next;
    selectionEmitSafe();
  }

  /**
   * 行主键 → TanStack row id；rowKey 缺失时退化为索引（仅非选择场景可达，S1）
   * @param record - 行记录
   * @param index - 行索引（rowKey 缺失时的退化 id 来源）
   * @returns 稳定的行标识字符串
   */
  function rowIdOf(record: T, index: number): string {
    const key = rowKey.value;
    const value = key ? record[key] : undefined;
    return value === undefined || value === null ? `index-${index}` : String(value);
  }

  /** 数据窗口变化时刷新快照中已存在 key 的行对象（S6：后写覆盖） */
  function refreshSnapshot() {
    const key = rowKey.value;
    if (!key) return;
    let collisionWarned = false;
    for (const record of rows.value) {
      const value = record[key];
      if (value === undefined || value === null) continue;
      const id = String(value);
      if (selectionSnapshot.has(id) && !collisionWarned && import.meta.env.DEV) {
        // S11：撞 key 属数据问题，只提示一次
        if (selectionSnapshot.get(id) !== record) {
          collisionWarned = true;
          warn(`rowKey "${key}" 存在重复值，行选择快照以后出现的记录为准。`);
        }
      }
      selectionSnapshot.set(id, record);
      dirtyKeys.delete(id);
    }
    // 选中行对象可能刚被刷新：重建投影
    if (selectedKeys.value.size > 0) selectionEmitSafe();
  }

  // ---- 引擎组装 -------------------------------------------------------------
  const table = useVueTable({
    get data() {
      return rows.value;
    },
    getRowId: (originalRow, index) => rowIdOf(originalRow, index),
    // 树形：子行走 childrenKey（空数组与缺字段都视为叶子）；展开模型接入后
    // getRowModel() 返回「父行 + 可见子行」的扁平序列，行带 depth/toggleExpanded
    getSubRows: (originalRow) => {
      const children = (originalRow as DataRecord)[childrenKey];
      return Array.isArray(children) ? children : [];
    },
    getExpandedRowModel: getExpandedRowModel(),
    columns: columns.map<ColumnDef<T>>((column) => ({
      accessorKey: column.key,
      header: column.title,
      enableSorting: column.sortable === true,
    })),
    initialState: {
      // 排序从投影初值构造（覆盖 defaultSort 与受控 sort 两种来源）
      sorting: sort.value ? [{ id: sort.value.key, desc: sort.value.direction === "desc" }] : [],
      // 初始 pageSize 须进 TanStack（此前只写对外投影，静态模式初始 pageSize≠10 不生效）；
      // 受控初值优先（组件层受控 getter 未传时返回 undefined，须防御性取数值配置）
      pagination: {
        pageIndex: Math.max(0, (controlledPageIndex() ?? 1) - 1),
        pageSize: controlledPageSize() ?? numericOption(options.pageSize) ?? 10,
      },
      // defaultExpandAll：true = 全部展开；否则全收起（TanStack expanded 空对象）
      expanded: tree?.defaultExpandAll === true ? true : {},
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: serverMode,
    manualSorting: serverMode,
    get state() {
      return { rowSelection: rowSelectionState.value };
    },
    enableRowSelection: selectionConfig?.selectable
      ? (row) => selectionConfig.selectable!(row.original)
      : selectionConfig !== undefined,
    enableMultiRowSelection: selectionConfig?.type !== "radio",
    onRowSelectionChange: (updater) => {
      const prev = rowSelectionState.value;
      const next = typeof updater === "function" ? updater(prev) : updater;
      // S4：radio 且 cancelable: false 时，解绑结果为空集则保持原状
      if (
        selectionConfig?.type === "radio" &&
        selectionConfig.cancelable === false &&
        !Object.keys(next).some((key) => next[key])
      ) {
        return;
      }
      applyRowSelection(next);
    },
  });

  watch(
    () => table.getState().pagination,
    (pagination) => {
      if (page.pageIndex === pagination.pageIndex + 1 && page.pageSize === pagination.pageSize)
        return;
      page.pageIndex = pagination.pageIndex + 1;
      page.pageSize = pagination.pageSize;
    },
    { immediate: true },
  );

  watch(
    () => table.getState().sorting,
    (sorting) => {
      const next: SortableOptions | undefined = sorting[0]
        ? { key: sorting[0].id, direction: sorting[0].desc ? "desc" : "asc" }
        : undefined;
      // 仅在语义发散时回写：toggleSort 已同步落值，等价对象回写会触发多余的重复加载
      if (sort.value?.key === next?.key && sort.value?.direction === next?.direction) return;
      sort.value = next;
    },
    { immediate: true },
  );

  // 静态数据源：ref/getter 会自动跟随；普通数组为快照，可用 reload() 重同步
  function syncData() {
    const data = toValue(options.data);
    if (data !== undefined && !Array.isArray(data)) {
      warn("data 必须是数组，已按空表处理。");
    }
    // 复制出新引用：就地修改同一个普通数组时 shallowRef 不会触发，行模型会停留在旧快照
    rows.value = Array.isArray(data) ? [...data] : [];
    page.total = rows.value.length;
  }

  watch(() => toValue(options.data), syncData, { immediate: true });

  function setPageIndex(pageIndex: number) {
    table.setPageIndex(Math.max(0, pageIndex - 1));
  }

  function setPageSize(pageSize: number) {
    table.setPageSize(pageSize);
    // TanStack 容量变更后停在最后一页（pageCount-1），R9 要求回到首页
    table.setPageIndex(0);
  }

  /** 排序应用的唯一管线：服务端模式归位第 1 页（R8）+ 投影落值 + TanStack setSorting。
   * 受控 sort 的外部同步与此共用（直接 setSorting 会漏服务端重载）
   * @param next - 目标排序（key + direction），undefined 表示取消排序
   */
  function applySort(next: SortableOptions | undefined) {
    // 服务端模式按新排序取数，必须先归位到首页（R8）
    if (serverMode && page.pageIndex !== 1) setPageIndex(1);
    // 同步落值：对外投影不能等 watcher（emit 需要立即读到新排序）
    sort.value = next;
    table.setSorting(next ? [{ id: next.key, desc: next.direction === "desc" }] : []);
  }

  /**
   * 排序三态：无 → asc → desc → 取消；非 sortable 列为空操作（R8）
   * @param key - 目标列 key
   */
  function toggleSort(key: string) {
    if (!columns.some((column) => column.key === key && column.sortable === true)) return;

    const current = sort.value;
    const direction =
      current?.key !== key ? "asc" : current.direction === "asc" ? "desc" : undefined;

    applySort(direction ? { key, direction } : undefined);
  }

  // 服务端模式：请求序号守卫，乱序返回的旧响应直接丢弃（R6）
  let requestId = 0;

  async function load() {
    const id = ++requestId;
    loading.value = true;
    // 下一次 load 开始时清除上一次的错误（无论该 load 是否为当前请求）
    error.value = undefined;
    try {
      await options.onLoad?.({
        // 事件/取数时机读取是安全的（form.state 非响应式但同步）；浅拷贝避免调用方改写真值
        form: search ? { ...search.form.state.values } : {},
        page: {
          pageIndex: page.pageIndex,
          pageSize: page.pageSize,
          total: page.total,
          pageSizeOpts: page.pageSizeOpts,
        },
        sort: sort.value,
        update: (data, total) => {
          if (id !== requestId) return;
          rows.value = Array.isArray(data) ? data : [];
          // total 缺省时保留旧值（R10）
          if (typeof total === "number") page.total = total;
        },
      });
    } catch (err) {
      // 乱序旧请求的失败直接丢弃（R6 同款守卫）
      if (id === requestId) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        error.value = normalized;
        console.error("[tu-design] <TableRender> onLoad 执行失败：", normalized);
      }
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  // 服务端模式下分页/排序变化即重取数；同一 tick 内多次变更只触发一次
  watch(
    () => (serverMode ? [page.pageIndex, page.pageSize, sort.value] : null),
    () => {
      void load();
    },
  );

  // ---- 受控同步（D11）：外部变更 → TanStack -------------------------------------
  // 各 watch 均带语义等值守卫：内部先行（动作已生效）或父回写回弹时跳过，
  // 严禁死循环与重复 onLoad（load watch 绑定投影，投影等值守卫兜底）。
  // pageIndex 受控（1-based；最小归 1）
  watch(controlledPageIndex, (next) => {
    if (next === undefined || page.pageIndex === next) return;
    table.setPageIndex(Math.max(0, next - 1));
  });

  // pageSize 受控：同步容量；pageIndex 未受控时保持 R9 归位第 1 页（两方都受控由父层联动）
  watch(controlledPageSize, (next) => {
    if (next === undefined || page.pageSize === next) return;
    table.setPageSize(next);
    if (controlledPageIndex() === undefined) table.setPageIndex(0);
  });

  // sort 受控：经 applySort 管线（服务端归位 + 重载不漏）；不可排序列警告并忽略
  watch(controlledSort, (next) => {
    if (next === undefined && sort.value === undefined) return;
    if (
      next &&
      sort.value &&
      next.key === sort.value.key &&
      next.direction === sort.value.direction
    ) {
      return;
    }
    if (next && !columns.some((c) => c.key === next.key && c.sortable === true)) {
      warn(`sort 受控值指向不可排序列 "${next.key}"，已忽略。`);
      return;
    }
    applySort(next);
  });

  // selectedKeys 受控：经 setSelection 写入（S5 selectable 过滤 / S12 待定 key 语义继承）
  watch(
    controlledSelectedKeys,
    (next) => {
      if (next === undefined) return;
      const current = selectedKeys.value;
      // 语义等值（内容而非引用）：内部勾选先行或父回写回弹时跳过，防 Set 重建触发的事件回环
      if (next.length === current.size && next.every((key) => current.has(key))) return;
      setSelection(next);
    },
    { immediate: true },
  );

  // ---- 列显隐（column visibility，R20–R24） -------------------------------------
  // 统一投影：受控初值 > defaultVisibleKeys（拆分式/聚合式 R26） > 全部可见。
  // 列显隐只动本 ref——不触发 onLoad、不重置 pageIndex/sort/selectedKeys（R25）。
  let emptyVisibleWarned = false;

  /**
   * 规范化：未知 key 静默忽略、按 columns 原序、空数组钳制为首列（R24，warn 一次）
   * @param keys - 目标可见列 key 列表（任意顺序，可含未知 key）
   * @returns 规范化后的可见列 key 列表（columns 原序）
   */
  function normalizeVisibleKeys(keys: readonly string[]): string[] {
    const known = columns.filter((column) => keys.includes(column.key)).map((column) => column.key);
    if (known.length > 0) return known;
    if (columns.length > 0) {
      if (!emptyVisibleWarned) {
        warn("可见列不能为空，已钳制为首列可见。");
        emptyVisibleWarned = true;
      }
      return [columns[0]!.key];
    }
    return [];
  }

  function sameVisibleKeys(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((key, index) => key === b[index]);
  }

  const parsedDefaultVisibleKeys = (() => {
    const raw = toValue(options.defaultVisibleKeys) ?? options.columnVisibility?.defaultVisibleKeys;
    return raw ? normalizeVisibleKeys(raw) : undefined;
  })();

  const visibleKeysInternal = ref<string[]>(
    controlledVisibleKeys()
      ? normalizeVisibleKeys(controlledVisibleKeys()!)
      : (parsedDefaultVisibleKeys ?? columns.map((column) => column.key)),
  );

  /**
   * 列显隐动作（面板交互/程序化）：规范化后更新统一投影
   * @param keys - 目标可见列 key 列表
   */
  function setVisibleKeys(keys: string[]) {
    visibleKeysInternal.value = normalizeVisibleKeys(keys);
  }

  // visibleKeys 受控：外部变更同步投影（规范化后语义等值跳过，防回弹）
  watch(controlledVisibleKeys, (next) => {
    if (next === undefined) return;
    const normalized = normalizeVisibleKeys(next);
    if (sameVisibleKeys(normalized, visibleKeysInternal.value)) return;
    visibleKeysInternal.value = normalized;
  });

  onMounted(() => {
    if (serverMode && (options.autoLoad ?? true)) void load();
    // S1：rowKey 在 defineTable 阶段可能尚未就绪（聚合式由 TableRender 回填），挂载时终审
    if (selectionConfig && !rowKey.value) {
      warn("rowSelection 需要有效的 rowKey 字段，已禁用行选择。");
    }
  });

  function reload(resetPage = false) {
    if (serverMode) {
      // 归位由分页 watch 触发重载；页码本就为首页时直接重载（避免双请求）
      if (resetPage && page.pageIndex !== 1) setPageIndex(1);
      else void load();
      return;
    }
    if (resetPage) setPageIndex(1);
    syncData();
  }

  // ---- 行选择动作与联动（S 系列） -------------------------------------------

  /**
   * 程序化设置选中集；不存在的 key 保留进入 dirtyKeys（S12）；不可选行被过滤（对齐 S5）
   * @param keys - 目标选中行的 key 列表（整体替换现有选中集）
   */
  function setSelection(keys: Array<string | number>) {
    const next: RowSelectionState = {};
    for (const key of keys) {
      const row = selectionSnapshot.get(String(key));
      // 快照中存在的行按 selectable 谓词过滤；待定 key（尚无行对象）无法判定的不拦
      if (row && selectionConfig?.selectable && !selectionConfig.selectable(row)) continue;
      next[String(key)] = true;
      if (!row) dirtyKeys.add(String(key));
    }
    applyRowSelection(next);
  }

  function clearSelection() {
    applyRowSelection({});
  }

  function toggleRowSelected(key: string, checked: boolean) {
    // S4：radio 且 cancelable: false 时，交互解绑最后一个选中为空操作
    if (!checked && selectionConfig?.type === "radio" && selectionConfig.cancelable === false) {
      return;
    }
    if (!checked) {
      const { [key]: _removed, ...rest } = rowSelectionState.value;
      applyRowSelection(rest);
      return;
    }
    // radio：单选互斥（S4）；checkbox：累加
    const next =
      selectionConfig?.type === "radio"
        ? { [key]: true }
        : { ...rowSelectionState.value, [key]: true };
    applyRowSelection(next);
  }

  /**
   * 拆分式装配口：TableRender setup 时回传组件 rowKey（S1）
   * @param key - 行主键字段名
   */
  function setRowKey(key: string | undefined) {
    if (rowKey.value === key) return;
    rowKey.value = key;
    // 聚合式下数据窗口早于 rowKey 就绪（pre-flush 先于子组件 setup），补建快照
    refreshSnapshot();
  }

  // 数据窗口变化（翻页或数据替换）：刷新快照；reserveOnPageChange: false 时清空选中（S6）
  watch([rows, () => page.pageIndex], () => {
    refreshSnapshot();
    if (selectionConfig && selectionConfig.reserveOnPageChange === false) clearSelection();
  });

  return {
    columns,
    table,
    page: readonly(page),
    sort: readonly(sort),
    loading: readonly(loading),
    error: readonly(error),
    reload,
    toggleSort,
    setPageIndex,
    setPageSize,
    selection: {
      get value(): T[] {
        return selectionRows.value;
      },
      get enabled(): boolean {
        return selectionEnabled.value;
      },
      get type(): "radio" | "checkbox" {
        return selectionConfig?.type ?? "checkbox";
      },
      get width(): number {
        return selectionConfig?.width ?? 48;
      },
    },
    selectedKeys: selectedKeys as Readonly<Ref<Set<string | number>>>,
    setSelection,
    clearSelection,
    toggleRowSelected,
    // getter 而非快照：setSearch 由 TableRender 在 setup 回填，读取须反映最新值
    get search() {
      return search;
    },
    setSearch,
    // 纯配置透传（渲染层消费；不支持运行时切换）
    virtual: options.virtual,
    height: options.height,
    tree,
    // 列显隐（R20–R24）：统一投影 + 动作 + 重置基准
    visibleKeys: readonly(visibleKeysInternal),
    setVisibleKeys,
    defaultVisibleKeys: parsedDefaultVisibleKeys,
    columnVisibility: options.columnVisibility,
    setRowKey,
  };
}
