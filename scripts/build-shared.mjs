/**
 * 生成共享依赖 bundle:vue + pinia + vue-router → IIFE,挂载 window.__MICRO_SHARED__。
 *
 * 产物:3 份 public/generated/shared-deps.js(host + 2 子应用;子应用副本仅独立运行时加载,
 * wujie 模式下 <script ignore> 被跳过,改由 jsBeforeLoaders 从 window.parent 注入引用)。
 *
 * 执行:任意 app 的 build script 内 `node ../../scripts/build-shared.mjs`(cwd 无关,
 * 路径由本文件位置推导);解析上下文 = host 包(host devDependencies 含 vite/vue/pinia/
 * vue-router;workspace 根没有这些依赖),经 createRequire + 动态 import 显式锚定。
 *
 * 注意:独立构建脚本,禁止复用 @repo/config-vite 的 defineAppConfig——工厂会装配 external 插件,
 * 把正要共享的依赖 external 掉。此处 configFile: false 双保险。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(workspaceRoot, "apps/micro-host");
const hostRequire = createRequire(join(hostRoot, "package.json"));

/**
 * 解析依赖实际安装版本(非 catalog range):优先子路径 package.json,退回主入口上溯
 * @param name 依赖包名
 * @returns 实际解析出的 semver 版本号
 */
function resolvedVersion(name) {
  let pkgJsonPath;
  try {
    pkgJsonPath = hostRequire.resolve(`${name}/package.json`);
  } catch {
    pkgJsonPath = join(dirname(hostRequire.resolve(name)), "../package.json");
  }
  return JSON.parse(readFileSync(pkgJsonPath, "utf8")).version;
}

const version = {
  vue: resolvedVersion("vue"),
  pinia: resolvedVersion("pinia"),
  vueRouter: resolvedVersion("vue-router"),
};

/**
 * 自动发现消费方:扫描 apps 目录下各 app 的 index.html,凡引用 shared-deps.js 的
 * app 获得一份副本。index.html 的引用即消费声明(新增子应用加一行 ignore 标签即
 * 自动覆盖;全部未引用时报错,暴露引用与产物的配置漂移)。
 * @returns 消费方目录列表(目录名与 index.html 路径)
 */
function discoverTargets() {
  const appsDir = join(workspaceRoot, "apps");
  const targets = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const htmlPath = join(appsDir, entry.name, "index.html");
    if (!existsSync(htmlPath)) continue;
    if (readFileSync(htmlPath, "utf8").includes("shared-deps.js")) {
      targets.push({
        app: entry.name,
        path: join(appsDir, entry.name, "public/generated/shared-deps.js"),
      });
    }
  }
  if (targets.length === 0) {
    throw new Error(
      "[shared-deps] 未发现引用 shared-deps.js 的 app:请检查各 app index.html 的引用标签",
    );
  }
  return targets;
}

// tmp 必须开在 host 包内:entry 的裸 import(vue 等)从 entry 位置向上解析,
// 需命中 apps/host/node_modules(pnpm 隔离布局,仓库根无这些依赖)
const tmpDir = mkdtempSync(join(hostRoot, ".shared-build-"));
try {
  // 入口:全量 namespace 对象经 window 暴露(逃逸出 bundle,tree-shaking 保留全部导出)
  const entry = join(tmpDir, "entry.js");
  writeFileSync(
    entry,
    `import * as vue from "vue";
import * as pinia from "pinia";
import * as vueRouter from "vue-router";
window.__MICRO_SHARED__ = {
  vue,
  pinia,
  vueRouter,
  version: ${JSON.stringify(version)},
};
`,
  );

  // vite 从 host 依赖树动态加载(pnpm 隔离布局下根目录不可裸引)
  const viteEntry = pathToFileURL(hostRequire.resolve("vite")).href;
  const viteModule = await import(viteEntry);
  const build = viteModule.build ?? viteModule.default?.build;

  await build({
    root: hostRoot,
    configFile: false,
    logLevel: "warn",
    // JS API 构建不自动注入 NODE_ENV define,缺失会让 vue/pinia/router 的 dev 分支残留
    // (产物体积翻倍,浏览器无 process 直接崩溃),显式锁定 production
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      outDir: join(tmpDir, "out"),
      emptyOutDir: true,
      minify: true,
      lib: {
        entry,
        formats: ["iife"],
        name: "__micro_shared_boot__",
        fileName: () => "shared-deps.js",
      },
    },
  });

  const targets = discoverTargets();
  for (const target of targets) {
    mkdirSync(dirname(target.path), { recursive: true });
    copyFileSync(join(tmpDir, "out", "shared-deps.js"), target.path);
  }
  console.log(
    `[shared-deps] vue ${version.vue} / pinia ${version.pinia} / vue-router ${version.vueRouter} → ${targets.length} 份 public/generated/shared-deps.js(${targets.map((t) => t.app).join(", ")})`,
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
