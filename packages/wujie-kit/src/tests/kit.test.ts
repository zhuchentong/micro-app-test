import { expect, expectTypeOf, test } from "vite-plus/test";
import { appEvents } from "../events.ts";
import {
  buildTabKey,
  buildTabUrl,
  createMicroAppStarter,
  parseLocation,
  parseTabUrl,
  startTabApp,
} from "../host.ts";
import type { StartAppOptions, TabAppOptions } from "../host.ts";
import { createSubBus, useHostProps } from "../sub.ts";
import type { SubAppConfig } from "../types.ts";
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
    menu: "sub:menu",
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

test("buildTabKey 确定性:query 键序无关,token 不参与", () => {
  expect(buildTabKey("sub-a", "/product", { id: "1", name: "x" })).toBe(
    buildTabKey("sub-a", "/product", { name: "x", id: "1" }),
  );
  expect(buildTabKey("sub-a", "/product", { id: "1", token: "t" })).toBe(
    buildTabKey("sub-a", "/product", { id: "1" }),
  );
  expect(buildTabKey("sub-a", "/product", { id: "1" })).not.toBe(
    buildTabKey("sub-a", "/product", { id: "2" }),
  );
});

test("parseTabUrl 解析 /{app}/{page}?{query},未注册 app 返回空", () => {
  expect(parseTabUrl("/sub-a/product?id=1", apps)).toEqual({
    app: "sub-a",
    page: "/product",
    query: { id: "1" },
  });
  expect(parseTabUrl("/sub-a", apps)).toEqual({ app: "sub-a", page: "/", query: undefined });
  expect(parseTabUrl("/unknown/x", apps)).toEqual({});
  expect(parseTabUrl("/sub-a/product?token=t&id=1", apps)).toEqual({
    app: "sub-a",
    page: "/product",
    query: { id: "1" },
  });
});

test("parseTabUrl 与 buildTabUrl 往返一致", () => {
  const url = buildTabUrl(apps[0]!.domain, "/product", { id: "1" });
  expect(url).toBe("http://localhost:7201/product?id=1");
  // buildTabKey 基于同样语义,重建/去重共用同一映射;
  // parseTabUrl 解析的是主应用地址栏(//{app}/{page}?{query}),非子应用 url
  const parsed = parseTabUrl("/sub-a/product?id=1", apps);
  expect(buildTabKey(parsed.app!, parsed.page!, parsed.query)).toBe(
    buildTabKey("sub-a", "/product", { id: "1" }),
  );
});

test("startTabApp 以唯一 name 启动,注入 tab props,关闭 sync", () => {
  const calls: StartAppOptions[] = [];
  const options: TabAppOptions = {
    startApp: (o) => {
      calls.push(o);
    },
    apps,
    baseProps: () => ({ user: { id: "u1", name: "宿主" }, theme: "dark" }),
    tab: {
      id: "sub-a|/product?id=1",
      app: "sub-a",
      page: "/product",
      query: { id: "1" },
      el: "#host-tab-1",
    },
  };

  startTabApp(options);

  expect(calls).toHaveLength(1);
  expect(calls[0].name).toMatch(/^sub-a-tab-[0-9a-z]+$/);
  expect(calls[0].name).not.toContain("/");
  expect(calls[0].url).toBe("http://localhost:7201/product?id=1");
  expect(calls[0].el).toBe("#host-tab-1");
  expect(calls[0].sync).toBe(false);
  expect(calls[0].alive).toBe(true);
  expect(calls[0].props).toEqual({
    user: { id: "u1", name: "宿主" },
    theme: "dark",
    tab: { id: "sub-a|/product?id=1", app: "sub-a", page: "/product" },
  });
});

test("startTabApp 未注册 tab.app 不调用 startApp", () => {
  const calls: StartAppOptions[] = [];
  startTabApp({
    startApp: (o) => {
      calls.push(o);
    },
    apps,
    baseProps: { user: { id: "u1", name: "宿主" }, theme: "light" },
    tab: { id: "x", app: "nope", page: "/", el: "#host-tab-x" },
  });
  expect(calls).toHaveLength(0);
});

test("reportMenu 以 props.tab.app 上报菜单,无 tab props 时 no-op", () => {
  const globalAny = globalThis as { window?: unknown };
  const originalWindow = globalAny.window;
  const emitted: Array<{ event: string; data?: unknown }> = [];
  globalAny.window = {
    $wujie: {
      props: { tab: { id: "t1", app: "sub-a", page: "/" } },
      bus: { $emit: (event: string, data?: unknown) => emitted.push({ event, data }) },
    },
  };

  try {
    const bus = createSubBus({ name: "子应用 A", accent: "#5b8ff9" } satisfies SubAppConfig);
    bus.reportMenu([{ label: "首页", path: "/" }]);
    expect(emitted).toEqual([
      { event: appEvents.menu, data: { app: "sub-a", menu: [{ label: "首页", path: "/" }] } },
    ]);

    // 无 tab props(独立运行/单容器遗留):no-op 不抛错
    globalAny.window = { $wujie: { props: {}, bus: { $emit: () => {} } } };
    expect(() => bus.reportMenu([{ label: "首页", path: "/" }])).not.toThrow();
    expect(emitted).toHaveLength(1);
  } finally {
    globalAny.window = originalWindow;
  }
});
