import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { TABS_STORAGE_KEY, configureTabOps, useTabsStore } from "./tabs";
import type { TabOps } from "./tabs";
import { apps } from "../apps";
import { buildTabKey } from "@repo/wujie-kit/host";

interface Ensured {
  id: string;
  app: string;
  page: string;
  containerN: number;
}

/** 宿主副作用 mock:记录实例的创建/销毁与纠偏下发,不触碰真实 wujie */
function createFakeOps() {
  const ensured: Ensured[] = [];
  const destroyed: string[] = [];
  const navigated: Array<{ id: string; page: string; query?: Record<string, string> }> = [];
  /** 可切换的失败开关:验证启动失败后的回滚与重试 */
  const control = { failEnsure: false };
  const ops: TabOps = {
    ensureInstance(tab, onFailed) {
      if (control.failEnsure) {
        onFailed?.(new Error("boom"));
        return;
      }
      ensured.push({ id: tab.id, app: tab.app, page: tab.page, containerN: tab.n });
    },
    async destroyInstance(tab) {
      destroyed.push(tab.id);
    },
    navigateTab(tab) {
      navigated.push({ id: tab.id, page: tab.page, query: tab.query });
    },
  };
  return { ops, ensured, destroyed, navigated, control };
}

/** node 环境下的 window/document/sessionStorage 最小桩(tabs store 仅用这几处宿主 API) */
let href = "http://localhost:7100/";
const sessionStorageStub = {
  store: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  },
  removeItem(key: string): void {
    this.store.delete(key);
  },
};

function stubGlobals(): void {
  href = "http://localhost:7100/";
  sessionStorageStub.store.clear();
  (globalThis as Record<string, unknown>).window = {
    location: {
      get href() {
        return href;
      },
    },
    history: { replaceState: (_s: unknown, _t: string, url: string) => (href = url) },
    sessionStorage: sessionStorageStub,
  };
  // tabs.ts 使用裸 sessionStorage 全局,node 环境需单独挂载
  (globalThis as Record<string, unknown>).sessionStorage = sessionStorageStub;
  (globalThis as Record<string, unknown>).document = { title: "" };
}

// 确定性时钟:lastActivatedAt 逐次递增,LRU 排序不依赖真实毫秒
const realNow = Date.now;
let clock = 1_000;

beforeEach(() => {
  stubGlobals();
  setActivePinia(createPinia());
  Date.now = () => ++clock;
});

afterEach(() => {
  Date.now = realNow;
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
  delete (globalThis as Record<string, unknown>).sessionStorage;
});

test("openTab 同参数确定性去重:复用记录与实例", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/products");
  await tabs.openTab("micro-app-demo", "/products");

  expect(tabs.tabs).toHaveLength(1);
  expect(ensured).toHaveLength(1);
});

test("openTab 返回新建标记:首次 true,去重复用 false,未注册 false", async () => {
  const { ops } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  expect(await tabs.openTab("micro-app-demo", "/products")).toBe(true);
  expect(await tabs.openTab("micro-app-demo", "/products")).toBe(false);
  expect(await tabs.openTab("nope", "/")).toBe(false);
});

test("openTab query 不同则是不同 Tab;未注册 app 被拒绝", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/product", { id: "1" });
  await tabs.openTab("micro-app-demo", "/product", { id: "2" });
  await tabs.openTab("nope", "/");

  expect(tabs.tabs).toHaveLength(2);
  expect(ensured).toHaveLength(2);
});

test("并发 openTab 同一页面只创建一个实例", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await Promise.all([
    tabs.openTab("micro-app-demo", "/products"),
    tabs.openTab("micro-app-demo", "/products"),
    tabs.activate(buildTabKey("micro-app-demo", "/products")),
  ]);

  expect(tabs.tabs).toHaveLength(1);
  expect(ensured).toHaveLength(1);
  expect(tabs.tabs[0].state).toBe("active");
});

test("closeTab 移除记录并销毁实例,激活相邻 Tab(左优先)", async () => {
  const { ops, destroyed } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  await tabs.openTab("micro-app-demo", "/products");
  const [homeId, productsId] = tabs.tabs.map((tab) => tab.id);

  await tabs.closeTab(productsId);

  expect(destroyed).toEqual([productsId]);
  expect(tabs.activeId).toBe(homeId);
  expect(tabs.tabs).toHaveLength(1);
  expect(tabs.tabs[0].state).toBe("active");
});

test("LRU 降级:超过保活上限时销毁最久未激活的 background 实例", async () => {
  const { ops, ensured, destroyed } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  for (let i = 0; i < 9; i++) {
    await tabs.openTab("micro-app-demo", `/page-${i}`);
  }

  expect(tabs.aliveCount).toBeLessThanOrEqual(8);
  expect(ensured).toHaveLength(9);
  expect(destroyed).toEqual([tabs.tabs[0].id]);
  expect(tabs.tabs[0].state).toBe("cold");
});

test("tabRoute/tabTitle 回报只作用于对应 Tab,并持久化", async () => {
  const { ops } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/product", { id: "1" });
  const id = tabs.tabs[0].id;
  tabs.applyTabRoute({ id, page: "/product", query: { id: "2" } });
  tabs.applyTabTitle({ id, title: "产品 2" });

  expect(tabs.tabs[0].page).toBe("/product");
  expect(tabs.tabs[0].query).toEqual({ id: "2" });
  expect(tabs.tabs[0].title).toBe("产品 2");
  expect(document.title).toBe("无界 MVP · 产品 2");

  const snapshot = JSON.parse(sessionStorageStub.store.get(TABS_STORAGE_KEY)!);
  expect(snapshot.tabs[0].title).toBe("产品 2");
});

test("启动恢复:sessionStorage 记录落回 cold,地址栏 Tab 按需重建", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  href = "http://localhost:7100/micro-app-demo/products";
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "micro-app-demo|/|",
          app: "micro-app-demo",
          page: "/",
          title: "首页",
          state: "active",
          lastActivatedAt: 123,
          n: 3,
        },
        {
          id: "micro-app-demo|/products|",
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "background",
          lastActivatedAt: 456,
          n: 7,
        },
      ],
      activeId: "micro-app-demo|/products|",
      seq: 7,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  expect(tabs.tabs).toHaveLength(2);
  expect(tabs.activeId).toBe("micro-app-demo|/products|");
  expect(ensured).toEqual([
    { id: "micro-app-demo|/products|", app: "micro-app-demo", page: "/products", containerN: 7 },
  ]);
  // seq 必须覆盖恢复记录的 max n,后续新 Tab 不撞容器号
  await tabs.openTab("micro-app-demo", "/about");
  expect(tabs.tabs[2].n).toBe(8);
});

test("实例启动失败回滚 cold,恢复后可重试", async () => {
  const { ops, ensured, control } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  control.failEnsure = true;
  await tabs.openTab("micro-app-demo", "/products");
  const tab = tabs.tabs[0];

  // 失败不得停留在 background/active 的假存活态
  expect(tab.state).toBe("cold");
  expect(ensured).toHaveLength(0);
  expect(tabs.activeId).toBeNull();

  control.failEnsure = false;
  await tabs.activate(tab.id);
  expect(tab.state).toBe("active");
  expect(ensured).toHaveLength(1);
});

test("销毁在途时重开同一页:新记录仍会启动实例", async () => {
  const { ops, ensured } = createFakeOps();
  const destroyed: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  ops.destroyInstance = async (tab) => {
    destroyed.push(tab.id);
    await gate;
  };
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  await tabs.openTab("micro-app-demo", "/products");
  const closingId = tabs.tabs[0].id;

  const closing = tabs.closeTab(closingId); // 销毁卡在 gate
  const opening = tabs.openTab("micro-app-demo", "/"); // 同一页面重开
  await opening;

  // 判据必须已同步失效:重开的记录要真正拿到新实例,而不是空转
  expect(destroyed).toEqual([closingId]);
  expect(tabs.tabs).toHaveLength(2);
  expect(ensured.filter((item) => item.id === closingId)).toHaveLength(2);
  expect(tabs.tabs[1].state).toBe("active");

  release();
  await closing;
});

test("endSession 销毁全部保活实例并清空状态与快照,地址栏/标题复位", async () => {
  const { ops, destroyed } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  await tabs.openTab("micro-app-demo", "/products");
  expect(tabs.aliveCount).toBe(2);

  await tabs.endSession();

  expect(tabs.tabs).toHaveLength(0);
  expect(tabs.activeId).toBeNull();
  expect(tabs.seq).toBe(0);
  expect(destroyed).toHaveLength(2);
  expect(sessionStorageStub.store.has(TABS_STORAGE_KEY)).toBe(false);
  expect(href).toBe("/");
  expect((globalThis as Record<string, unknown>).document).toMatchObject({
    title: "无界 MVP · 主应用",
  });
});

test("endSession 在 activate 在途时进入:销毁清单包含刚建好的实例", async () => {
  const { ops, ensured, destroyed } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  const opening = tabs.openTab("micro-app-demo", "/"); // activate 在途(cold→activating,nextTick 窗口)
  await tabs.endSession(); // 先等在途实例化落定,销毁清单不漏掉刚建好的实例
  await opening;

  // 记录虽已清空(activate 恢复后因记录移除而放弃激活),但实例已被销毁,不悬挂
  expect(tabs.tabs).toHaveLength(0);
  expect(ensured).toHaveLength(1);
  expect(destroyed).toHaveLength(1);
});

test("S1 归一化:恢复态漂移记录改写 id 为 canonical,activeId 经映射修正", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  href = "http://localhost:7100/"; // 地址栏不指向子应用:仅验证快照归一化与激活
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "micro-app-demo|/|", // 身份停在 /,内容已被页内导航漂到 /products
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "active",
          lastActivatedAt: 123,
          n: 3,
        },
      ],
      activeId: "micro-app-demo|/|",
      seq: 3,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  expect(tabs.tabs).toHaveLength(1);
  expect(tabs.tabs[0]!.id).toBe("micro-app-demo|/products|");
  expect(tabs.tabs[0]!.n).toBe(3);
  expect(tabs.activeId).toBe("micro-app-demo|/products|");
  // 归一化后的记录按新身份激活重建,实例收到归一化后的 page
  expect(ensured).toEqual([
    { id: "micro-app-demo|/products|", app: "micro-app-demo", page: "/products", containerN: 3 },
  ]);
});

test("S1 撞车合并:规范记录优先保留,被删漂移记录的 activeId 改指保留者", async () => {
  const { ops } = createFakeOps();
  configureTabOps(ops, apps);
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "micro-app-demo|/|", // 漂移:身份 /,内容 /products(与规范记录撞车)
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "active",
          lastActivatedAt: 1,
          n: 2,
        },
        {
          id: "micro-app-demo|/products|", // 规范记录:id === canonical,优先保留
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "background",
          lastActivatedAt: 2,
          n: 7,
        },
      ],
      activeId: "micro-app-demo|/|", // 被删记录:经映射改指规范保留者
      seq: 7,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  expect(tabs.tabs).toHaveLength(1);
  expect(tabs.tabs[0]!.id).toBe("micro-app-demo|/products|");
  expect(tabs.tabs[0]!.n).toBe(7); // 保留的是规范记录自身的 n
  expect(tabs.activeId).toBe("micro-app-demo|/products|");
});

test("S1 撞车合并:双方均漂移保留 n 较小者,activeId 改指保留者", async () => {
  const { ops } = createFakeOps();
  configureTabOps(ops, apps);
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "micro-app-demo|/|", // 漂移:n 小 → 保留
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "active",
          lastActivatedAt: 1,
          n: 2,
        },
        {
          id: "micro-app-demo|/about|", // 漂移:n 大 → 被删
          app: "micro-app-demo",
          page: "/products",
          title: "产品",
          state: "background",
          lastActivatedAt: 2,
          n: 5,
        },
      ],
      activeId: "micro-app-demo|/about|", // 被删记录:改指 n 小保留者
      seq: 5,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  expect(tabs.tabs).toHaveLength(1);
  expect(tabs.tabs[0]!.id).toBe("micro-app-demo|/products|");
  expect(tabs.tabs[0]!.n).toBe(2);
  expect(tabs.activeId).toBe("micro-app-demo|/products|");
});

test("S1 时序:归一化先于 URL 匹配,漂移身份不再命中地址栏,新建干净 Tab 激活", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  href = "http://localhost:7100/micro-app-demo"; // 直访 /micro-app-demo → 解析 (micro-app-demo, "/")
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "micro-app-demo|/|", // 僵尸身份:内容已漂到 /table
          app: "micro-app-demo",
          page: "/table",
          title: "表格",
          state: "active",
          lastActivatedAt: 9,
          n: 1,
        },
      ],
      activeId: "micro-app-demo|/|",
      seq: 1,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  // 归一化后僵尸身份已变 micro-app-demo|/table|,URL (micro-app-demo,"/") 匹配不到 → 新建干净 Tab
  expect(tabs.tabs).toHaveLength(2);
  expect(tabs.tabs[0]!.id).toBe("micro-app-demo|/table|");
  expect(tabs.tabs[0]!.state).toBe("cold"); // 未被 URL 激活,保持冷置
  const fresh = tabs.tabs[1]!;
  expect(fresh.id).toBe("micro-app-demo|/|");
  expect(fresh.page).toBe("/");
  expect(fresh.n).toBe(2);
  expect(tabs.activeId).toBe("micro-app-demo|/|");
  // 激活的是干净记录:地址栏停在 /micro-app-demo,不被漂移内容改写为 /micro-app-demo/table
  expect(href).toBe("/micro-app-demo");
  expect(ensured).toEqual([
    { id: "micro-app-demo|/|", app: "micro-app-demo", page: "/", containerN: 2 },
  ]);
});

test("S2 纠偏:openTab 命中漂移记录且实例 background → navigateTab 下发、记录更新", async () => {
  const { ops, navigated } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  const homeId = tabs.tabs[0]!.id;
  // 模拟页内导航漂移:身份 micro-app-demo|/| 的内容漂到 /products
  tabs.applyTabRoute({ id: homeId, page: "/products" });
  await tabs.openTab("micro-app-demo", "/about"); // 首页 Tab 转 background
  expect(tabs.tabs[0]!.state).toBe("background");

  // 会话内菜单重开漂移 Tab:请求 / 与记录当前内容 /products 漂移 → 纠偏
  const created = await tabs.openTab("micro-app-demo", "/");
  expect(created).toBe(false); // 去重命中,纠偏也不算新建
  expect(tabs.tabs[0]!.page).toBe("/");
  expect(tabs.tabs[0]!.query).toBeUndefined();
  expect(navigated).toEqual([{ id: homeId, page: "/" }]);
  expect(href).toBe("/micro-app-demo"); // 地址栏回到身份对应路径,不再停留 /micro-app-demo/products
});

test("S2 纠偏:实例 cold 时不下发 navigateTab,ensureInstance 收到新 page", async () => {
  const { ops, ensured, navigated } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  const homeId = tabs.tabs[0]!.id;
  tabs.applyTabRoute({ id: homeId, page: "/products" });
  tabs.tabs[0]!.state = "cold"; // 模拟 LRU 降级后的 cold 漂移记录

  await tabs.openTab("micro-app-demo", "/");

  expect(navigated).toEqual([]); // 无保活实例,不发生事件下发
  expect(tabs.tabs[0]!.page).toBe("/");
  // 首开 + 纠偏重建各一次;重建这一次 ensureInstance 必须读到纠偏后的 page(而非漂移值)
  expect(ensured).toHaveLength(2);
  expect(ensured.at(-1)).toEqual({
    id: homeId,
    app: "micro-app-demo",
    page: "/",
    containerN: tabs.tabs[0]!.n,
  });
});

test("无 requested 的 activate 语义不变:URL 跟随实例当前内容,不下发纠偏", async () => {
  const { ops, navigated } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("micro-app-demo", "/");
  const homeId = tabs.tabs[0]!.id;
  tabs.applyTabRoute({ id: homeId, page: "/products" });
  await tabs.openTab("micro-app-demo", "/about"); // 首页 background

  await tabs.activate(homeId); // TabsBar / closeTab 邻居激活场景:无 requested

  expect(navigated).toEqual([]); // 不纠偏
  expect(tabs.tabs[0]!.page).toBe("/products"); // 内容不被动
  expect(href).toBe("/micro-app-demo/products"); // 地址栏跟随实例
});
