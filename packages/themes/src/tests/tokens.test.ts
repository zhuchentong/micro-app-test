import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { applyTheme } from "../apply.ts";
import { themePresets, themeVars } from "../tokens.ts";

/** node 环境无 DOM:用轻量 stub 断言写入的变量键值与 class 切换(store 测试同款守卫风格) */
function createRootStub() {
  const written = new Map<string, string>();
  const classToggles: Array<[string, boolean]> = [];
  return {
    written,
    classToggles,
    style: {
      setProperty(name: string, value: string): void {
        written.set(name, value);
      },
    },
    setAttribute(name: string, value: string): void {
      written.set(name, value);
    },
    classList: {
      toggle(name: string, force: boolean): void {
        classToggles.push([name, force]);
      },
    },
  } as unknown as HTMLElement & {
    written: Map<string, string>;
    classToggles: Array<[string, boolean]>;
  };
}

test("preset 覆盖全部 token,且无 undefined/空值", () => {
  for (const mode of ["light", "dark"] as const) {
    expect(Object.keys(themePresets[mode])).toHaveLength(themeVars.length);
    for (const name of themeVars) {
      expect(themePresets[mode][name], `${mode} ${name}`).toMatch(/^#[0-9a-f]{3,8}$/i);
    }
  }
});

test("light 与 dark 值存在差异(非同一套值)", () => {
  const diffs = themeVars.filter((name) => themePresets.light[name] !== themePresets.dark[name]);
  expect(diffs.length).toBeGreaterThan(0);
});

test("applyTheme 写入 data-theme、.dark class 与全部变量", () => {
  const root = createRootStub();
  applyTheme(root, "dark");
  expect(root.written.get("data-theme")).toBe("dark");
  expect(root.classToggles).toContainEqual(["dark", true]);
  for (const name of themeVars) {
    expect(root.written.get(name)).toBe(themePresets.dark[name]);
  }
  expect(root.written.size).toBe(themeVars.length + 1);
});

test("applyTheme 切换 light 覆盖 dark 值并移除 .dark", () => {
  const root = createRootStub();
  applyTheme(root, "dark");
  applyTheme(root, "light");
  expect(root.written.get("data-theme")).toBe("light");
  expect(root.classToggles).toContainEqual(["dark", false]);
  expect(root.written.get("--app-bg-page")).toBe(themePresets.light["--app-bg-page"]);
});

test("applyTheme overrides 覆盖 preset 值,undefined 项忽略", () => {
  const root = createRootStub();
  applyTheme(root, "light", { "--app-accent": "#123456", "--app-brand": undefined });
  expect(root.written.get("--app-accent")).toBe("#123456");
  // 显式 undefined 的覆盖项不写入,保留 preset 值
  expect(root.written.get("--app-brand")).toBe(themePresets.light["--app-brand"]);
});

test("切换模式后未覆盖 token 回落新 preset,覆盖项由调用方持续下发保持", () => {
  const root = createRootStub();
  applyTheme(root, "light", { "--app-accent": "#123456" });
  applyTheme(root, "dark", { "--app-accent": "#123456" });
  expect(root.written.get("--app-bg-page")).toBe(themePresets.dark["--app-bg-page"]);
  expect(root.written.get("--app-accent")).toBe("#123456");
});

test("tokens.css 在 :root 与 .dark 两块均含 --app-* 桥接", () => {
  const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"));
  for (const block of [rootBlock, darkBlock]) {
    const bridged = block.match(/var\(--app-/g) ?? [];
    // background/foreground/card(+fg)/popover(+fg)/primary(+fg)/muted(+fg)/accent(+fg)/border/input/ring = 14 项
    expect(bridged.length).toBeGreaterThanOrEqual(14);
  }
  // 状态色保留官方 oklch,不桥接
  expect(css).toContain("--destructive: oklch(");
});
