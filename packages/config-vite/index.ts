import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@vizejs/vite-plugin/vite-plus";
import Icons from "unplugin-icons/vite";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import IconsResolver from "unplugin-icons/resolver";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import external from "vite-plugin-external";
import type { Plugin, UserConfig } from "vite";

/** app 侧 vite.config.ts 只需声明的差异项 */
export interface AppOptions {
  /** 必须显式传入且端口写字面量:scripts/dev.mjs 与 stop.mjs 按正则提取 server.port */
  server?: UserConfig["server"];
  /** 某 app 的额外插件(追加在共享插件之后) */
  plugins?: UserConfig["plugins"];
  define?: UserConfig["define"];
  /** 生产构建将共享依赖(vue/pinia/vue-router)external 到 window.__MICRO_SHARED__;默认 true */
  externalSharedDeps?: boolean;
}

/**
 * 共享依赖 → window.__MICRO_SHARED__ 命名空间。
 * 与 scripts/build-shared.mjs 的产物(3 份 public/generated/shared-deps.js)一一对应:
 * host index.html 同步加载;子应用经 jsBeforeLoaders 从 window.parent 注入,独立运行走 <script ignore>。
 */
const SHARED_DEPS: Record<string, string> = {
  vue: "vue",
  pinia: "pinia",
  "vue-router": "vueRouter",
};

/**
 * 读取本包依赖树内共享依赖的解析后版本(与 build-shared.mjs 同源,均为 catalog 锁定版本)。
 * 读取失败返回 undefined,调用方跳过版本比对注入,不阻塞构建。
 * @returns 全局命名空间 → 实际版本 的映射(vue/pinia/vue-router);任一依赖解析失败时为 undefined
 */
function readSharedVersions(): Record<string, string> | undefined {
  try {
    const req = createRequire(import.meta.url);
    return Object.fromEntries(
      Object.keys(SHARED_DEPS).map((name) => {
        let pkgPath: string;
        try {
          pkgPath = req.resolve(`${name}/package.json`);
        } catch {
          pkgPath = join(dirname(req.resolve(name)), "../package.json");
        }
        return [SHARED_DEPS[name], String(JSON.parse(readFileSync(pkgPath, "utf8")).version)];
      }),
    );
  } catch {
    return undefined;
  }
}

/**
 * 生产构建将共享依赖 external 到 window.__MICRO_SHARED__。
 * 机制:插件为命名 external 生成 CJS shim stash(module.exports = window.__MICRO_SHARED__.<ns>)
 * 并内联进产物,由 rolldown 互操作解析 named imports。apply 限定 build:dev 保持 Vite 预打包。
 * @returns external 化共享依赖的 vite 插件(仅生产构建生效)
 */
function sharedExternalsPlugin(): Plugin {
  return external({
    apply: "build",
    externals: Object.fromEntries(
      Object.entries(SHARED_DEPS).map(([id, ns]) => [id, `window.__MICRO_SHARED__.${ns}`]),
    ),
  });
}

/**
 * dev(serve)阶段从 index.html 剥离 shared-deps 引用:public/libs 产物仅生产构建生成,
 * 避免开发时 404 噪音;build 保留(host 同步加载 / 子应用 <script ignore> 由 wujie 跳过)。
 * @returns 按 dev/build 阶段剥离或保留 shared-deps 脚本引用的 vite 插件
 */
function sharedDepsHtmlPlugin(): Plugin {
  const tagPattern = /[ \t]*<script src="[^"]*generated\/shared-deps\.js"[^>]*><\/script>\r?\n?/g;
  return {
    name: "micro-shared-deps-html",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        return ctx.server ? html.replace(tagPattern, "") : html;
      },
    },
  };
}

/** 注册表条目形状(manifest 单源字段 + 端口;与 @repo/wujie-kit 的 MicroAppManifest 结构兼容) */
export interface MicroAppRegistryEntry {
  key: string;
  name: string;
  accent: string;
  menu?: Array<{ label: string; path: string; query?: Record<string, string> }>;
  mode?: "tab" | "gateway";
  /** 从 apps/<name>/vite.config.ts 提取的 server.port 字面量 */
  port: number;
}

/** microAppRegistryPlugin 提供的虚拟模块 id */
export const VIRTUAL_MICRO_APP_REGISTRY = "virtual:micro-app-registry";

/** 虚拟模块 resolve 后的内部 id(vite 约定 \0 前缀) */
const RESOLVED_MICRO_APP_REGISTRY = `\0${VIRTUAL_MICRO_APP_REGISTRY}`;

/**
 * 读取并校验子应用注册表:扫描 apps/<name>/app.manifest.json(身份单源),端口从各
 * vite.config.ts 提取 server.port 字面量(正则与 scripts/dev.mjs、stop.mjs 保持一致,
 * 端口唯一源仍是 vite.config 字面量,manifest 不收录端口)。
 * 校验失败直接抛错:配置加载期快速失败,杜绝坏注册表静默进入宿主。
 * @param workspaceRoot 仓库根目录
 * @returns 按 key 排序的注册表条目(gateway 与 tab 应用同册,消费端按 mode 分流)
 */
function readMicroAppRegistry(workspaceRoot: string): MicroAppRegistryEntry[] {
  const appsDir = join(workspaceRoot, "apps");
  const entries: MicroAppRegistryEntry[] = [];
  const seenKeys = new Map<string, string>();
  const seenPorts = new Map<number, string>();

  for (const name of readdirSync(appsDir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const appRoot = join(appsDir, name.name);
    const manifestPath = join(appRoot, "app.manifest.json");
    if (!existsSync(manifestPath)) continue; // 宿主等非注册应用无 manifest,自然跳过

    /**
     * manifest 校验失败出口:抛错中断配置加载(快速失败)
     * @param reason 人类可读的失败原因
     */
    function fail(reason: string): never {
      throw new Error(`[micro-app-registry] ${manifestPath} ${reason}`);
    }
    const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (typeof raw !== "object" || raw === null) fail("不是 JSON 对象");
    const manifest = raw as Record<string, unknown>;
    if (typeof manifest.key !== "string" || !/^[\w-]+$/.test(manifest.key)) {
      fail("key 缺失或含非法字符(仅允许字母数字下划线连字符)");
    }
    if (typeof manifest.name !== "string" || manifest.name.length === 0) fail("name 缺失");
    if (typeof manifest.accent !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(manifest.accent)) {
      fail("accent 缺失或不是 #RRGGBB(AA) 色值");
    }
    if (manifest.mode !== undefined && manifest.mode !== "tab" && manifest.mode !== "gateway") {
      fail('mode 只允许 "tab" / "gateway"');
    }

    const portMatch = /server:\s*\{[^}]*\bport:\s*(\d+)/.exec(
      readFileSync(join(appRoot, "vite.config.ts"), "utf8"),
    );
    if (!portMatch) fail("对应 vite.config.ts 未找到 server.port 字面量");
    const port = Number(portMatch[1]);

    const dupKey = seenKeys.get(manifest.key);
    if (dupKey) fail(`key "${manifest.key}" 与 ${dupKey} 重复`);
    const dupPort = seenPorts.get(port);
    if (dupPort) fail(`port ${port} 与 ${dupPort} 重复`);
    seenKeys.set(manifest.key, name.name);
    seenPorts.set(port, name.name);

    entries.push({
      key: manifest.key,
      name: manifest.name,
      accent: manifest.accent,
      ...(manifest.menu === undefined
        ? {}
        : { menu: manifest.menu as MicroAppRegistryEntry["menu"] }),
      ...(manifest.mode === undefined ? {} : { mode: manifest.mode }),
      port,
    });
  }

  if (entries.length === 0) {
    throw new Error("[micro-app-registry] apps/ 下未发现任何 app.manifest.json");
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * 子应用注册聚合插件(host 专用):把 apps/<name>/app.manifest.json 与各 vite.config.ts 的
 * server.port 字面量聚合成 virtual:micro-app-registry 虚拟模块,宿主 apps.ts 据此
 * 构建注册表,新增子应用零登记。类型声明见 apps/micro-host/src/types/registry.d.ts。
 * 注意:注册表在模块首次加载时读取并缓存,改动 manifest 后需重启 host dev。
 * @returns 注册表聚合 vite 插件
 */
export function microAppRegistryPlugin(): Plugin {
  let cache: MicroAppRegistryEntry[] | null = null;
  return {
    name: "micro-app-registry",
    resolveId(id) {
      return id === VIRTUAL_MICRO_APP_REGISTRY ? RESOLVED_MICRO_APP_REGISTRY : null;
    },
    load(id) {
      if (id !== RESOLVED_MICRO_APP_REGISTRY) return null;
      // workspaceRoot 推导同 defineAppConfig:本模块打包后 import.meta.url 恒为源码位置
      cache ??= readMicroAppRegistry(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
      return [
        `// generated by microAppRegistryPlugin(源:apps/<name>/app.manifest.json + vite.config.ts 端口字面量;改动后需重启 dev)`,
        `export const microAppEntries = ${JSON.stringify(cache, null, 2)};`,
        "",
      ].join("\n");
    },
  };
}

/**
 * 共享 app 级 vite 配置工厂:封装 tailwindcss 挂载、@repo/tu-design 与 @repo/share/ui
 * 组件按需引入与 ui.source.css 生成,app 侧 vite.config.ts 仅保留 server 差异项。
 * 外加 wujie 依赖共享:生产构建 external vue/pinia/vue-router → window.__MICRO_SHARED__。
 *
 * 执行上下文(已实测):
 * - 本工厂被 config 打包后 import.meta.url 恒为本模块源码位置
 *   (<root>/packages/config-vite/index.ts),故 workspace 根由模块位置稳定推导;
 * - `vp run <pkg>#<script>` 的任务解析 pre-pass 会以仓库根为 cwd 多次执行
 *   本配置,真实 vite dev/build/test 进程的 cwd 才是 app root。
 * 因此:app root 用 cwd 是否位于 <root>/apps/ 下判定;pre-pass(cwd=仓库根)
 * 跳过生成物写入与插件装配,避免错误路径污染与误告警。
 * @param options app 侧声明的差异项(server 端口、追加插件等,全部可缺省)
 * @returns 可从 app 侧 vite.config.ts 直接导出的 vite 配置(pre-pass 下为精简配置)
 */
export function defineAppConfig(options: AppOptions = {}) {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const cwd = process.cwd();
  const appsDir = `${join(workspaceRoot, "apps")}${sep}`;
  const appRoot = cwd.startsWith(appsDir) ? cwd : null;
  const uiSrcDir = join(workspaceRoot, "packages/tu-design/src");
  const shareSrcDir = join(workspaceRoot, "packages/share/src");

  if (appRoot) {
    // Tailwind 扫描 @repo/tu-design 组件源码:vite root 外的目录,显式 @source 注册。
    // config 加载时生成 src/styles/generated/ui.source.css(gitignored),供 style.css @import 消费。
    const generatedDir = join(appRoot, "src/styles/generated");
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(
      join(generatedDir, "ui.source.css"),
      `/* generated by vite.config:请勿提交或手改 */\n@source ${JSON.stringify(uiSrcDir)};\n@source ${JSON.stringify(shareSrcDir)};\n`,
    );
  }

  const sharedVersions = readSharedVersions();
  const withSharedExternals = options.externalSharedDeps !== false;

  return defineConfig(
    {
      server: options.server,
      resolve: {
        alias: {
          // tu-design vendor 组件(registry 新版)使用 @/ 别名指包内 src(如 @/lib/utils),
          // 消费方(app)构建管道统一注册解析;@repo/* workspace 导入不受影响
          "@": uiSrcDir,
        },
      },
      define: {
        // 子应用构建期期望版本:wujie-kit/src/sub.ts 的版本漂移检查消费;缺失时检查自动跳过
        ...(sharedVersions ? { __MICRO_SHARED_VERSIONS__: JSON.stringify(sharedVersions) } : {}),
        ...options.define,
      },
      plugins: [
        ...(appRoot
          ? [
              tailwindcss(),
              // vue/vue-router/pinia API 自动导入:ref/computed/watch 等免 import(编译期注入显式
              // import,与 sharedExternals 外置机制无冲突);已显式 import 的标识符不重复注入,
              // 存量代码零迁移。dts 生成物入 src/types/generated/(gitignored),dev/build 启动时
              // 自动重新生成。注意:仅 app 构建管道生效,packages/* 源码仍须显式 import
              // (share 包内测试为纯 TS 环境,入口/测试文件勿依赖自动导入)。
              AutoImport({
                imports: ["vue", "vue-router", "pinia"],
                dts: "src/types/generated/auto-imports.d.ts",
              }),
              // iconify 图标按需编译:<icon-tdesign-xxx /> → 内联 SVG 组件,零运行时依赖、无网络请求
              // 数据源 @iconify-json/tdesign 已显式安装,CI 无需 autoInstall
              Icons({
                autoInstall: false,
                // pnpm 严格隔离下 tdesign 数据仅在本包 node_modules,插件默认从 process.cwd()(app root)
                // 解析会 not found;本模块 import.meta.url 打包后恒为源码位置,锚定包目录即可
                collectionsNodeResolvePath: dirname(fileURLToPath(import.meta.url)),
                // 本地图标集合:<icon-svg-xxx /> 从 <app>/src/assets/svgs/xxx.svg 按需加载
                // (appRoot 分支内 cwd 恒为 app root,各 app 维护独立 svg 目录;目录缺失时仅该集合图标不可用,不影响启动)
                customCollections: {
                  svg: FileSystemIconLoader(join(process.cwd(), "src/assets/svgs")),
                },
              }),
              // @repo/tu-design + @repo/share/ui 组件免 import 按需引入(dirs 递归按文件名注册:
              // tu-design components/ui 上游件原名,components/app 自研件前缀名;share/ui 全部组件含 layouts 子目录)
              // 同名冲突治理:dirs 首位 tu-design 优先(unplugin allowOverrides 默认 false,同名后注册者被忽略),
              // share/ui 新增组件前须先与 tu-design 组件名查重,避免静默失效
              // dts 生成物入 src/types/generated/(gitignored),dev/build 启动时自动重新生成
              // 图标经 IconsResolver 按需解析:prefix "icon" → <icon-tdesign-xxx /> / <icon-svg-xxx />,
              // enabledCollections 锁定 TDesign 防误用其它集合,customCollections 注册本地图标集合 svg
              Components({
                dirs: [join(uiSrcDir, "components"), join(shareSrcDir, "ui")],
                dts: "src/types/generated/components.d.ts",
                resolvers: [
                  IconsResolver({
                    prefix: "icon",
                    enabledCollections: ["tdesign"],
                    customCollections: ["svg"],
                  }),
                ],
              }),
              ...(withSharedExternals ? [sharedExternalsPlugin(), sharedDepsHtmlPlugin()] : []),
              ...(options.plugins ?? []),
            ]
          : []),
      ],
    },
    { tasks: false },
  );
}
