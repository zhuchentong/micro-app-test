import { expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useMenuStore } from "./menu";

test("未上报时回落静态注册表菜单(manifest 单源:兜底与子应用自报同源)", () => {
  setActivePinia(createPinia());
  const menu = useMenuStore();

  expect(menu.menuFor("micro-app-demo").map((item) => item.path)).toEqual([
    "/",
    "/table",
    "/form",
    "/products",
  ]);
});

test("上报后覆盖静态兜底,重复上报幂等,未注册 app 被拒绝", () => {
  setActivePinia(createPinia());
  const menu = useMenuStore();

  menu.applyReport({
    app: "micro-app-demo",
    menu: [
      { label: "首页", path: "/" },
      { label: "关于", path: "/about" },
    ],
  });
  expect(menu.menuFor("micro-app-demo").map((item) => item.path)).toEqual(["/", "/about"]);

  // 重复上报按 app key 幂等覆盖(保活重报/remount 重报安全)
  menu.applyReport({ app: "micro-app-demo", menu: [{ label: "首页", path: "/" }] });
  expect(menu.menuFor("micro-app-demo")).toHaveLength(1);

  // 未注册 app:拒绝写入且渲染为空
  expect(() => menu.applyReport({ app: "nope", menu: [{ label: "x", path: "/" }] })).not.toThrow();
  expect(menu.menuFor("nope")).toEqual([]);
});
