import { expect, test } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import type { MenuGroup } from "@repo/wujie-kit";
import { useMenuStore } from "./menu";

test("未上报时回落静态注册表菜单(manifest 单源:兜底与子应用自报同源)", () => {
  setActivePinia(createPinia());
  const menu = useMenuStore();

  // 静态兜底来自 micro-app-demo/app.manifest.json(分组形状),整体比较守住单源
  expect(menu.menuFor("micro-app-demo")).toEqual([
    {
      label: "示例",
      icon: "dashboard",
      children: [
        { label: "页面布局", path: "/" },
        { label: "表格布局", path: "/table" },
        { label: "表单页", path: "/form" },
        { label: "产品", path: "/products" },
      ],
    },
  ]);
});

test("上报后覆盖静态兜底,重复上报幂等,未注册 app 被拒绝", () => {
  setActivePinia(createPinia());
  const menu = useMenuStore();

  menu.applyReport({
    app: "micro-app-demo",
    menu: [
      { label: "导航", children: [{ label: "首页", path: "/" }] },
      { label: "其它", children: [{ label: "关于", path: "/about" }] },
    ],
  });
  expect(menu.menuFor("micro-app-demo")).toEqual([
    { label: "导航", children: [{ label: "首页", path: "/" }] },
    { label: "其它", children: [{ label: "关于", path: "/about" }] },
  ]);

  // 重复上报按 app key 幂等覆盖(保活重报/remount 重报安全)
  menu.applyReport({
    app: "micro-app-demo",
    menu: [{ label: "导航", children: [{ label: "首页", path: "/" }] }],
  });
  expect(menu.menuFor("micro-app-demo")).toEqual([
    { label: "导航", children: [{ label: "首页", path: "/" }] },
  ]);

  // 未注册 app:拒绝写入且渲染为空
  expect(() =>
    menu.applyReport({ app: "nope", menu: [{ label: "x", children: [] }] }),
  ).not.toThrow();
  expect(menu.menuFor("nope")).toEqual([]);
});

test("非法上报形状被防御拒绝:非数组/组缺非空 label/children 非数组均不覆盖", () => {
  setActivePinia(createPinia());
  const menu = useMenuStore();
  // 合法基线先写入,验证防御只拒绝非法载荷、不回滚已上报的有效值
  const valid: MenuGroup[] = [{ label: "导航", children: [{ label: "首页", path: "/" }] }];
  menu.applyReport({ app: "micro-app-demo", menu: valid });

  // bus payload 实际来自子应用沙箱,类型层无法约束运行时形状,故以断言强制模拟坏数据
  const badShapes: unknown[] = [
    null, // menu 非数组
    [{ children: [] }], // 组缺非空 label
    [{ label: "导航", children: "no" }], // children 非数组
    [{ label: "", children: [] }], // label 空字符串
  ];
  for (const bad of badShapes) {
    expect(() =>
      menu.applyReport({ app: "micro-app-demo", menu: bad as MenuGroup[] }),
    ).not.toThrow();
    // 非法载荷不落盘:保持上次有效上报(幂等覆盖语义不被坏数据破坏)
    expect(menu.menuFor("micro-app-demo")).toEqual(valid);
  }
});
