import { expect, expectTypeOf, test } from "vite-plus/test";
import { appEvents } from "../events.ts";
import { createMicroAppStarter, parseLocation } from "../host.ts";
import type { StartAppOptions } from "../host.ts";
import { useHostProps } from "../sub.ts";
import type { HostProps, MicroApp } from "../types.ts";

const apps: MicroApp[] = [
  { key: "sub-a", name: "子应用 A", domain: "http://localhost:7201", color: "#5b8ff9" },
];

test("parseLocation 识别注册的 appKey,空 path 默认 /", () => {
  expect(parseLocation("?sub-a=", apps)).toEqual({ app: "sub-a", path: "/" });
});

test("parseLocation 跳过 token 参数", () => {
  expect(parseLocation("?token=abc&sub-a=/about", apps)).toEqual({ app: "sub-a", path: "/about" });
});

test("parseLocation 未注册 key 返回空对象", () => {
  expect(parseLocation("?unknown=/x", apps)).toEqual({});
});

test("appEvents 事件契约字段齐全", () => {
  expect(appEvents).toMatchObject({
    title: "sub:title",
    notify: "sub:notify",
    broadcast: "host:broadcast",
    state: "host:state",
    stateRequest: "sub:state-request",
  });
});

test("createMicroAppStarter 透传静态 props 并触发 onStarted", () => {
  const calls: StartAppOptions[] = [];
  const startApp = (options: StartAppOptions) => {
    calls.push(options);
  };
  const onStarted: MicroApp[] = [];
  const startedUrls: string[] = [];
  const props = { user: { id: "u1", name: "宿主" }, theme: "light" };

  const start = createMicroAppStarter({
    startApp,
    apps,
    props,
    onStarted: (app, url) => {
      onStarted.push(app);
      startedUrls.push(url);
    },
  });

  start("sub-a", "/about");

  expect(calls).toHaveLength(1);
  expect(calls[0].name).toBe("sub-a");
  expect(calls[0].url).toBe("http://localhost:7201/about");
  expect(calls[0].props).toEqual(props);
  expect(onStarted).toEqual([apps[0]]);
  expect(startedUrls).toEqual(["http://localhost:7201/about"]);
});

test("createMicroAppStarter props 为函数时每次启动求值,取最新状态", () => {
  const calls: StartAppOptions[] = [];
  const startApp = (options: StartAppOptions) => {
    calls.push(options);
  };
  let rev = 0;

  const start = createMicroAppStarter({
    startApp,
    apps,
    props: () => {
      rev += 1;
      return {
        user: { id: `u${rev}`, name: `用户${rev}` },
        theme: rev % 2 === 1 ? "light" : "dark",
      };
    },
  });

  start("sub-a");
  start("sub-a");

  expect(calls).toHaveLength(2);
  expect(calls[0].props).toEqual({ user: { id: "u1", name: "用户1" }, theme: "light" });
  expect(calls[1].props).toEqual({ user: { id: "u2", name: "用户2" }, theme: "dark" });
});

test("createMicroAppStarter 未注册 key 不调用 startApp 也不触发 onStarted", () => {
  const startAppCalls: StartAppOptions[] = [];
  let startedCount = 0;

  const start = createMicroAppStarter({
    startApp: (options) => {
      startAppCalls.push(options);
    },
    apps,
    props: { user: { id: "u1", name: "宿主" }, theme: "light" },
    onStarted: () => {
      startedCount += 1;
    },
  });

  start("unknown");

  expect(startAppCalls).toHaveLength(0);
  expect(startedCount).toBe(0);
});

test("useHostProps 类型推断为 HostProps | undefined", () => {
  expectTypeOf(useHostProps()).toEqualTypeOf<HostProps | undefined>();
  // 泛型扩展:注入额外字段的子应用可自定义形状,类型不丢失
  useHostProps<{ user: HostProps["user"]; theme: string; extra: number }>();
});
