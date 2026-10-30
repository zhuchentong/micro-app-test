import { expect, test } from "vite-plus/test";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import { appEvents } from "@repo/wujie-kit";
import { createHostStoreSync } from "../host.ts";
import { createSubStoreSync } from "../sub.ts";
import { useThemeStore } from "../stores/theme.ts";
import { useUserStore } from "../stores/user.ts";

type Listener = (data?: unknown) => void;

/**
 * 全双工 mock bus:$on/$off/$emit。
 * $emit 记录事件到 events 并同步分发给监听者 —— host 与子应用挂同一实例即可端到端联动。
 */
function createMockBus() {
  const events: Array<{ event: string; data?: unknown }> = [];
  const listeners = new Map<string, Set<Listener>>();
  const bus = {
    $on<T = unknown>(event: string, callback: (data?: T) => void): void {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(callback as Listener);
    },
    $off(event: string, callback?: Listener): void {
      if (!callback) {
        listeners.delete(event);
        return;
      }
      listeners.get(event)?.delete(callback);
    },
    $emit(event: string, data?: unknown): void {
      events.push({ event, data });
      listeners.get(event)?.forEach((cb) => cb(data));
    },
  };
  return { bus, listeners, events };
}

// 注意:rev 为 host 模块级单调计数,以下用例中仅第一个用例可断言绝对值,
// 其余用例均使用相对断言,避免用例顺序耦合。

test("emitSnapshot 首次 rev=1、再次 rev=2", () => {
  const pinia = createPinia();
  const { bus, events } = createMockBus();
  const sync = createHostStoreSync({ pinia, bus });

  sync.emitSnapshot();
  sync.emitSnapshot();

  expect(events).toHaveLength(2);
  expect(events[0]).toMatchObject({
    event: appEvents.state,
    data: { user: { id: "", name: "" }, theme: "light", rev: 1 },
  });
  expect(events[1]).toMatchObject({
    event: appEvents.state,
    data: { user: { id: "", name: "" }, theme: "light", rev: 2 },
  });
});

test("toggleTheme 后 watch 自动广播且 rev 递增", async () => {
  const pinia = createPinia();
  const { bus, events } = createMockBus();
  const sync = createHostStoreSync({ pinia, bus });
  const theme = useThemeStore(pinia);

  theme.toggleTheme();
  await nextTick();

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ event: appEvents.state, data: { theme: "dark" } });
  const firstRev = (events[0].data as { rev: number }).rev;

  theme.toggleTheme();
  await nextTick();

  expect(events).toHaveLength(2);
  expect((events[1].data as { rev: number }).rev).toBe(firstRev + 1);

  sync.stop();
});

test("stop() 后不再自动广播", async () => {
  const pinia = createPinia();
  const { bus, events } = createMockBus();
  const sync = createHostStoreSync({ pinia, bus });
  const theme = useThemeStore(pinia);

  sync.emitSnapshot();
  expect(events).toHaveLength(1);

  sync.stop();
  theme.toggleTheme();
  await nextTick();

  expect(events).toHaveLength(1);
});

test("createSubStoreSync 收到 host:state 后两 store 被更新", () => {
  const pinia = createPinia();
  const { bus, listeners } = createMockBus();
  const sync = createSubStoreSync({ pinia, bus });

  sync.register();
  expect(listeners.get(appEvents.state)?.size).toBe(1);

  bus.$emit(appEvents.state, { user: { id: "u1", name: "宿主" }, theme: "dark", rev: 1 });

  const theme = useThemeStore(pinia);
  const user = useUserStore(pinia);
  expect(theme.theme).toBe("dark");
  expect(user.user).toEqual({ id: "u1", name: "宿主" });
});

test("先发 rev=5 再发 rev=3,过期事件被丢弃", () => {
  const pinia = createPinia();
  const { bus } = createMockBus();
  const sync = createSubStoreSync({ pinia, bus });

  sync.register();
  bus.$emit(appEvents.state, { user: { id: "u5", name: "新" }, theme: "dark", rev: 5 });
  bus.$emit(appEvents.state, { user: { id: "u3", name: "旧" }, theme: "light", rev: 3 });

  const theme = useThemeStore(pinia);
  const user = useUserStore(pinia);
  expect(theme.theme).toBe("dark");
  expect(user.user).toEqual({ id: "u5", name: "新" });
});

test("register 两次仅注册一个处理器,发一次事件只更新一次", () => {
  const pinia = createPinia();
  const { bus, listeners } = createMockBus();
  const sync = createSubStoreSync({ pinia, bus });

  // 统计 store action 调用次数,验证单次事件只产生一次更新
  let actionCalls = 0;
  useThemeStore(pinia).$onAction(() => {
    actionCalls += 1;
  });
  useUserStore(pinia).$onAction(() => {
    actionCalls += 1;
  });

  sync.register();
  sync.register();

  expect(listeners.get(appEvents.state)?.size).toBe(1);

  bus.$emit(appEvents.state, { user: { id: "u1", name: "宿主" }, theme: "dark", rev: 1 });

  expect(actionCalls).toBe(2); // setUser + setTheme,而非 4
});

test("dispose 后事件不再生效", () => {
  const pinia = createPinia();
  const { bus, listeners } = createMockBus();
  const sync = createSubStoreSync({ pinia, bus });

  sync.register();
  sync.dispose();

  expect(listeners.get(appEvents.state)?.size ?? 0).toBe(0);

  bus.$emit(appEvents.state, { user: { id: "u1", name: "宿主" }, theme: "dark", rev: 9 });

  const theme = useThemeStore(pinia);
  const user = useUserStore(pinia);
  expect(theme.theme).toBe("light");
  expect(user.user).toEqual({ id: "", name: "" });
});

test("无 bus 时 register() 不抛错(no-op)", () => {
  const pinia = createPinia();
  const sync = createSubStoreSync({ pinia });

  expect(() => sync.register()).not.toThrow();
  expect(() => sync.dispose()).not.toThrow();

  const theme = useThemeStore(pinia);
  expect(theme.theme).toBe("light");
});

test("register 从 window.$wujie.props 水合初始状态", () => {
  const pinia = createPinia();
  const globalAny = globalThis as { window?: unknown };
  const originalWindow = globalAny.window;
  // node 环境无 DOM:临时构造最小 window 供 props 水合
  globalAny.window = {
    $wujie: { props: { user: { id: "u9", name: "预置用户" }, theme: "dark" } },
  };

  try {
    const sync = createSubStoreSync({ pinia });
    sync.register();

    const theme = useThemeStore(pinia);
    const user = useUserStore(pinia);
    expect(theme.theme).toBe("dark");
    expect(user.user).toEqual({ id: "u9", name: "预置用户" });
  } finally {
    globalAny.window = originalWindow;
  }
});

test("握手:子应用注册后请求快照,host 回发并完成首次同步", () => {
  const hostPinia = createPinia();
  const subPinia = createPinia();
  const { bus, events } = createMockBus();

  const host = createHostStoreSync({ pinia: hostPinia, bus });
  // host 先有状态,子应用后才注册 —— 正是启动时的真实时序
  useThemeStore(hostPinia).setTheme("dark");
  useUserStore(hostPinia).setUser({ id: "u1", name: "宿主" });

  createSubStoreSync({ pinia: subPinia, bus }).register();

  // 子应用 register 发出 sub:state-request,host 监听回发 host:state,子应用已完成同步
  expect(events.some((item) => item.event === appEvents.stateRequest)).toBe(true);
  const theme = useThemeStore(subPinia);
  const user = useUserStore(subPinia);
  expect(theme.theme).toBe("dark");
  expect(user.user).toEqual({ id: "u1", name: "宿主" });

  host.stop();
});

test("握手:收到 stateRequest 后 host 回发一次 host:state", () => {
  const pinia = createPinia();
  const { bus, events } = createMockBus();
  const sync = createHostStoreSync({ pinia, bus });

  bus.$emit(appEvents.stateRequest);

  const states = events.filter((item) => item.event === appEvents.state);
  expect(states).toHaveLength(1);
  expect((states[0].data as { theme: string }).theme).toBe("light");

  sync.stop();
});
