import { beforeEach, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { LAYOUT_STORAGE_KEY, useLayoutStore } from "./layout";
import type { LayoutName } from "./layout";

/** node 环境下的 localStorage 最小桩(layout store 仅用 get/set) */
const localStorageStub = {
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

/** 每用例隔离:清空桩存储 + 全新 pinia(store 的 loadLayout 在首次实例化时读全局) */
beforeEach(() => {
  localStorageStub.store.clear();
  (globalThis as Record<string, unknown>).localStorage = localStorageStub;
  setActivePinia(createPinia());
});

test("无持久化时回落 workspace", () => {
  const layout = useLayoutStore();
  expect(layout.current).toBe("workspace");
});

test("恢复合法的持久化布局", () => {
  localStorageStub.store.set(LAYOUT_STORAGE_KEY, "blank");
  const layout = useLayoutStore();
  expect(layout.current).toBe("blank");
});

test("非法持久化值回落 workspace", () => {
  localStorageStub.store.set(LAYOUT_STORAGE_KEY, "bogus");
  const layout = useLayoutStore();
  expect(layout.current).toBe("workspace");
});

test("setLayout 切换并持久化", () => {
  const layout = useLayoutStore();
  layout.setLayout("blank");
  expect(layout.current).toBe("blank");
  expect(localStorageStub.store.get(LAYOUT_STORAGE_KEY)).toBe("blank");
});

test("setLayout 忽略未注册的布局名(运行时守卫)", () => {
  const layout = useLayoutStore();
  layout.setLayout("bogus" as LayoutName);
  expect(layout.current).toBe("workspace");
  expect(localStorageStub.store.has(LAYOUT_STORAGE_KEY)).toBe(false);
});

test("hasStoredLayout:无持久化记录为 false,合法记录为 true,非法值视为无记录", () => {
  let layout = useLayoutStore();
  expect(layout.hasStoredLayout).toBe(false);

  localStorageStub.store.set(LAYOUT_STORAGE_KEY, "blank");
  setActivePinia(createPinia());
  layout = useLayoutStore();
  expect(layout.hasStoredLayout).toBe(true);

  setActivePinia(createPinia());
  localStorageStub.store.set(LAYOUT_STORAGE_KEY, "bogus");
  layout = useLayoutStore();
  expect(layout.current).toBe("workspace");
  expect(layout.hasStoredLayout).toBe(false);
});

test("applyAppDefault 仅在新建 Tab 时应用默认布局", () => {
  const layout = useLayoutStore();
  layout.setLayout("blank");

  layout.applyAppDefault("workspace", false);
  expect(layout.current).toBe("blank");

  layout.applyAppDefault("workspace", true);
  expect(layout.current).toBe("workspace");
  expect(localStorageStub.store.get(LAYOUT_STORAGE_KEY)).toBe("workspace");
});
