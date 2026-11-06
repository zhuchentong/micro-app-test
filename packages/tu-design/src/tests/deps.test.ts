import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

// 依赖不变式(强制层;update-ui.mjs ④ 依赖镜像段为便利层,两处共用 deps-policy.json 单一来源):
//   A. 引用闭包:src 实际外部引用(含动态 import/require;排除相对/别名/node:/@repo 自引用)
//      ⊆ dependencies ∪ peerDependencies —— 源码直出,消费方编译需解析全部 import(含 import type)
//   B. 镜像:非 ignore 依赖与 @tu-design/vue 上游 manifest 兼容,即本地可安装集合 ⊆ 上游声明集合
//      (同 major、0.x 同 minor,且本地 min ≥ 上游 min);catalog: 引用先解析 catalog 实际值
//   C. ignore 生命周期:deps-policy.json 的条目必须仍存在于上游 manifest,上游清理后提示移除
// @tu-design/vue 未安装(全新 clone 未 pnpm install)时 B/C 跳过,A 仍执行。

type Triple = [number, number, number];
type UpstreamPkg = { version: string; dependencies: Record<string, string> };

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const themesRoot = join(uiRoot, "..", "themes");
const workspaceYaml = readFileSync(join(uiRoot, "..", "..", "pnpm-workspace.yaml"), "utf8");

const localPkg = JSON.parse(readFileSync(join(uiRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const policy = JSON.parse(readFileSync(join(uiRoot, "deps-policy.json"), "utf8")) as {
  ignore: Record<string, string>;
};
const ignoreList = Object.keys(policy.ignore);
const declared = new Set([
  ...Object.keys(localPkg.dependencies ?? {}),
  ...Object.keys(localPkg.peerDependencies ?? {}),
]);

let upstream: UpstreamPkg | null = null;
try {
  const require = createRequire(join(themesRoot, "package.json"));
  upstream = JSON.parse(
    readFileSync(require.resolve("@tu-design/vue/package.json"), "utf8"),
  ) as UpstreamPkg;
} catch {
  upstream = null;
}

/** ^X.Y.Z 专用解析(仓库依赖全为 caret);0.x 的 minor 为破坏性位 */
function parseCaret(range: string): Triple | null {
  const m = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function cmpTriple(a: Triple, b: Triple): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
/** 本地可安装集合是否 ⊆ 上游声明集合(同 major、0.x 同 minor,且本地 min ≥ 上游 min) */
function subsetCompat(ours: Triple, theirs: Triple): boolean {
  if (ours[0] !== theirs[0]) return false;
  if (ours[0] === 0 && ours[1] !== theirs[1]) return false;
  return cmpTriple(ours, theirs) >= 0;
}

function catalogValue(name: string): string | undefined {
  const lines = workspaceYaml.split("\n");
  const start = lines.findIndex((line) => line.trim() === "catalog:");
  if (start === -1) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s+"?${escaped}"?:\\s*"?([^"'#\\s]+)"?`);
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() !== "" && /^\S/.test(line)) break; // 离开 catalog 块
    const m = re.exec(line);
    if (m?.[1]) return m[1];
  }
  return undefined;
}
function resolveRange(range: string, pkgName: string): string {
  return range === "catalog:" ? (catalogValue(pkgName) ?? range) : range;
}

const importPatterns = [
  /\bfrom\s+["']([^"']+)["']/g, // import/export ... from "x"
  /^\s*import\s+["']([^"']+)["']/gm, // 副作用导入(行首锚定,避免误吃 css @import)
  /\bimport\(\s*["']([^"']+)["']/g, // 动态导入
  /\brequire\(\s*["']([^"']+)["']/g, // require
];
function externalPackageOf(specifier: string): string | null {
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("~") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("node:")
  ) {
    return null;
  }
  const segments = specifier.split("/");
  const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : (segments[0] ?? "");
  if (name === "" || name.startsWith("@repo/")) return null;
  return name;
}
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "tests" || entry.name === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("引用闭包不变式(A)", () => {
  it("src 实际外部引用 ⊆ dependencies ∪ peerDependencies", () => {
    const files = collectSourceFiles(join(uiRoot, "src"));
    expect(files.length).toBeGreaterThan(0);
    const undeclared = new Set<string>();
    for (const file of files) {
      const code = readFileSync(file, "utf8");
      for (const pattern of importPatterns) {
        for (const m of code.matchAll(pattern)) {
          const specifier = m[1];
          if (!specifier) continue;
          const name = externalPackageOf(specifier);
          if (name && !declared.has(name)) {
            undeclared.add(`${name}(${relative(uiRoot, file)})`);
          }
        }
      }
    }
    expect([...undeclared]).toEqual([]);
  });
});

describe.skipIf(upstream === null)("依赖镜像不变式(B/C)", () => {
  const upstreamDeps = upstream?.dependencies ?? {};

  it("B: 非 ignore 依赖与上游 manifest 兼容(本地 ⊆ 上游)", () => {
    const problems: string[] = [];
    for (const [name, upRange] of Object.entries(upstreamDeps)) {
      if (ignoreList.includes(name)) continue;
      const raw = localPkg.dependencies?.[name];
      if (raw === undefined) {
        problems.push(`${name}:未声明(上游 ${upRange})`);
        continue;
      }
      const local = resolveRange(raw, name);
      const ours = parseCaret(local);
      const theirs = parseCaret(upRange);
      if (!ours || !theirs) {
        if (local !== upRange) {
          problems.push(`${name}:非 caret 且不一致 本地 ${local} / 上游 ${upRange}`);
        }
        continue;
      }
      if (!subsetCompat(ours, theirs)) {
        problems.push(
          `${name}:本地 ${raw} 与上游 ${upRange} 不兼容(须同 major 且本地 min ≥ 上游 min)`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("C: ignore 条目仍存在于上游 manifest(过期则清理 deps-policy.json)", () => {
    const stale = ignoreList.filter((name) => !(name in upstreamDeps));
    expect(stale).toEqual([]);
  });
});
