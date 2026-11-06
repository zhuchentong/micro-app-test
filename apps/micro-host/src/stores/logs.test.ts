import { beforeEach, expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useLogsStore } from "./logs";

beforeEach(() => {
  setActivePinia(createPinia());
});

test("add 最新在前且 id 自增", () => {
  const logs = useLogsStore();
  logs.add("host", "第一条");
  logs.add("micro-app-demo", "第二条");
  expect(logs.entries).toHaveLength(2);
  expect(logs.entries[0]).toMatchObject({ source: "micro-app-demo", text: "第二条" });
  expect(logs.entries[1]).toMatchObject({ source: "host", text: "第一条" });
  expect(logs.entries[0].id).toBeGreaterThan(logs.entries[1].id);
  expect(typeof logs.entries[0].time).toBe("string");
});

test("超过上限裁剪最旧,保留最新 50 条", () => {
  const logs = useLogsStore();
  for (let i = 0; i <= 50; i++) logs.add("host", `消息 ${i}`);
  expect(logs.entries).toHaveLength(50);
  expect(logs.entries[0]?.text).toBe("消息 50");
  expect(logs.entries.at(-1)?.text).toBe("消息 1");
});
