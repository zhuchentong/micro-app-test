import { expect, test } from "vite-plus/test";
import { keepBusEventAlive } from "../bus.ts";
import { appEvents } from "../events.ts";
import type { SyncBus } from "../types.ts";

/** 最小 mock bus:$on/$off/$emit + 监听表,与 store 侧 sync.test.ts 的 createMockBus 同构 */
function createMockBus() {
  const listeners = new Map<string, Set<(data?: unknown) => void>>();
  const bus: SyncBus = {
    $emit(event: string, data?: unknown): void {
      listeners.get(event)?.forEach((cb) => cb(data));
    },
    $on<T = unknown>(event: string, callback: (data?: T) => void): void {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(callback as (data?: unknown) => void);
    },
    $off(event: string, callback?: (data?: unknown) => void): void {
      if (!callback) {
        listeners.delete(event);
        return;
      }
      listeners.get(event)?.delete(callback);
    },
  };
  return { bus, listeners };
}

test("注册后事件获得常驻订阅者", () => {
  const { bus, listeners } = createMockBus();

  const stop = keepBusEventAlive(bus, appEvents.state);

  expect(listeners.get(appEvents.state)?.size).toBe(1);
  stop();
});

test("可变参数多事件各自注册一个占位监听", () => {
  const { bus, listeners } = createMockBus();

  const stop = keepBusEventAlive(bus, appEvents.state, appEvents.broadcast);

  expect(listeners.get(appEvents.state)?.size).toBe(1);
  expect(listeners.get(appEvents.broadcast)?.size).toBe(1);
  stop();
});

test("emit 分发到占位监听不抛错,不影响真实监听者", () => {
  const { bus, listeners } = createMockBus();
  let received: unknown;
  bus.$on(appEvents.state, (data?: unknown) => {
    received = data;
  });

  const stop = keepBusEventAlive(bus, appEvents.state);

  expect(() => bus.$emit(appEvents.state, { rev: 1 })).not.toThrow();
  expect(received).toEqual({ rev: 1 });
  expect(listeners.get(appEvents.state)?.size).toBe(2);
  stop();
});

test("dispose 清空占位监听,重复调用安全(幂等)", () => {
  const { bus, listeners } = createMockBus();

  const stop = keepBusEventAlive(bus, appEvents.state);
  stop();

  expect(listeners.get(appEvents.state)?.size ?? 0).toBe(0);
  expect(() => stop()).not.toThrow();
  expect(listeners.get(appEvents.state)?.size ?? 0).toBe(0);
});
