import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { TABS_STORAGE_KEY, configureTabOps, useTabsStore } from "./tabs";
import type { TabOps } from "./tabs";
import { apps } from "../apps";
import { buildTabKey } from "@repo/wujie-kit/host";

interface Ensured {
  id: string;
  app: string;
  containerN: number;
}

/** 宿主副作用 mock:记录实例的创建/销毁,不触碰真实 wujie */
function createFakeOps() {
  const ensured: Ensured[] = [];
  const destroyed: string[] = [];
  /** 可切换的失败开关:验证启动失败后的回滚与重试 */
  const control = { failEnsure: false };
  const ops: TabOps = {
    ensureInstance(tab, onFailed) {
      if (control.failEnsure) {
        onFailed?.(new Error("boom"));
        return;
      }
      ensured.push({ id: tab.id, app: tab.app, containerN: tab.n });
    },
    async destroyInstance(tab) {
      destroyed.push(tab.id);
    },
  };
  return { ops, ensured, destroyed, control };
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

  await tabs.openTab("sub-a", "/products");
  await tabs.openTab("sub-a", "/products");

  expect(tabs.tabs).toHaveLength(1);
  expect(ensured).toHaveLength(1);
});

test("openTab query 不同则是不同 Tab;未注册 app 被拒绝", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("sub-a", "/product", { id: "1" });
  await tabs.openTab("sub-a", "/product", { id: "2" });
  await tabs.openTab("nope", "/");

  expect(tabs.tabs).toHaveLength(2);
  expect(ensured).toHaveLength(2);
});

test("并发 openTab 同一页面只创建一个实例", async () => {
  const { ops, ensured } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await Promise.all([
    tabs.openTab("sub-a", "/products"),
    tabs.openTab("sub-a", "/products"),
    tabs.activate(buildTabKey("sub-a", "/products")),
  ]);

  expect(tabs.tabs).toHaveLength(1);
  expect(ensured).toHaveLength(1);
  expect(tabs.tabs[0].state).toBe("active");
});

test("closeTab 移除记录并销毁实例,激活相邻 Tab(左优先)", async () => {
  const { ops, destroyed } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  await tabs.openTab("sub-a", "/");
  await tabs.openTab("sub-a", "/products");
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
    await tabs.openTab("sub-a", `/page-${i}`);
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

  await tabs.openTab("sub-a", "/product", { id: "1" });
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
  href = "http://localhost:7100/sub-a/products";
  sessionStorageStub.setItem(
    TABS_STORAGE_KEY,
    JSON.stringify({
      tabs: [
        {
          id: "sub-a|/|",
          app: "sub-a",
          page: "/",
          title: "首页",
          state: "active",
          lastActivatedAt: 123,
          n: 3,
        },
        {
          id: "sub-a|/products|",
          app: "sub-a",
          page: "/products",
          title: "产品",
          state: "background",
          lastActivatedAt: 456,
          n: 7,
        },
      ],
      activeId: "sub-a|/products|",
      seq: 7,
    }),
  );

  const tabs = useTabsStore();
  await tabs.init(apps);

  expect(tabs.tabs).toHaveLength(2);
  expect(tabs.activeId).toBe("sub-a|/products|");
  expect(ensured).toEqual([{ id: "sub-a|/products|", app: "sub-a", containerN: 7 }]);
  // seq 必须覆盖恢复记录的 max n,后续新 Tab 不撞容器号
  await tabs.openTab("sub-a", "/about");
  expect(tabs.tabs[2].n).toBe(8);
});

test("实例启动失败回滚 cold,恢复后可重试", async () => {
  const { ops, ensured, control } = createFakeOps();
  configureTabOps(ops, apps);
  const tabs = useTabsStore();

  control.failEnsure = true;
  await tabs.openTab("sub-a", "/products");
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

  await tabs.openTab("sub-a", "/");
  await tabs.openTab("sub-a", "/products");
  const closingId = tabs.tabs[0].id;

  const closing = tabs.closeTab(closingId); // 销毁卡在 gate
  const opening = tabs.openTab("sub-a", "/"); // 同一页面重开
  await opening;

  // 判据必须已同步失效:重开的记录要真正拿到新实例,而不是空转
  expect(destroyed).toEqual([closingId]);
  expect(tabs.tabs).toHaveLength(2);
  expect(ensured.filter((item) => item.id === closingId)).toHaveLength(2);
  expect(tabs.tabs[1].state).toBe("active");

  release();
  await closing;
});
