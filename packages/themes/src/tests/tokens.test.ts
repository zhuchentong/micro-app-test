import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vite-plus/test";
import { applyTheme } from "../apply.ts";
import { themePresets, themeVars, type ThemeVarName } from "../tokens.ts";

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

test("tokens.css vendor 段含 --app-* 桥接与状态色族,本地段含静态令牌", () => {
  const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  // vendor 切分标记(update-ui.mjs 依赖,不可缺失)
  expect(css).toContain("===== @tu-design/vue tokens (vendored");
  expect(css).toContain("===== workspace extensions");
  const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"));
  // 按 --app- 引用计数(fmt 折行会把 var( 与 --app- 拆行,var\(--app- 正则会漏计)
  for (const block of [rootBlock, darkBlock]) {
    const refs = block.match(/--app-[a-z0-9-]+/g) ?? [];
    // 上游 0.5.0 每块 27 处:背景/前景/卡/浮层/主色/中性/强调 12 + 状态色全族 12 + border/input/ring 3
    expect(refs.length).toBeGreaterThanOrEqual(27);
    for (const key of [
      "--app-bg-page",
      "--app-text-1",
      "--app-accent",
      "--app-border",
      "--app-destructive",
      "--app-destructive-soft",
      "--app-destructive-foreground",
      "--app-success-soft",
      "--app-warning-soft",
      "--app-info-soft",
    ]) {
      expect(refs).toContain(key);
    }
  }
  // 状态色已桥接 --app-*(0.5.0 起不再保留纯 oklch)
  expect(css).toContain("--destructive: var(--app-destructive,");
  expect(css).toContain("--destructive-foreground: var(--app-destructive-foreground,");
  expect(css).toContain("--success-soft: var(--app-success-soft,");
  // 上游新增档位
  expect(css).toContain("--radius-2xl");
  // 本地段静态非颜色令牌
  expect(css).toContain("--app-radius-md: 10px");
  expect(css).toContain("--app-space-4: 16px");
  expect(css).toContain("--app-shadow-e1:");
  expect(css).toContain("--color-brand: var(--app-brand");
});

test("tokens.lock.json 与 vendor 段一致(上游变更可检出;本地段不参与)", () => {
  const lock = JSON.parse(readFileSync(new URL("../../tokens.lock.json", import.meta.url), "utf8"));
  const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  const vendoredStart = css.indexOf("*/", css.indexOf("@tu-design/vue tokens")) + 2;
  const vendoredEnd = css.indexOf("/* ===== workspace extensions");
  const vendoredCss = css.slice(vendoredStart, vendoredEnd).trim();
  // 空白归一化:fmt 会重排 vendor 段空白,hash 仅检测内容漂移(与 update-ui.mjs 同规则)
  expect(lock.files["src/tokens.css"]).toBe(
    createHash("sha256").update(vendoredCss.replace(/\s+/g, "")).digest("hex"),
  );
});

test("tokens.lock 版本与安装的 @tu-design/vue 一致", () => {
  const require = createRequire(import.meta.url);
  const upstream = JSON.parse(readFileSync(require.resolve("@tu-design/vue/package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("../../tokens.lock.json", import.meta.url), "utf8"));
  expect(lock.version).toBe(upstream.version);
});

test("data 图表色 8 项完整且明暗同值(规范:按序号固定取用)", () => {
  for (let i = 1; i <= 8; i++) {
    const name = `--app-data-${i}` as ThemeVarName;
    expect(themePresets.light[name]).toBe(themePresets.dark[name]);
    expect(themePresets.light[name]).toMatch(/^#[0-9a-f]{6}$/i);
  }
});
