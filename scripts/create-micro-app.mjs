/**
 * micro-app 脚手架生成器(`vp run new`):以 @repo/templates/micro-app 为模板创建新子应用。
 *
 * 职责:
 * 1. 交互收集应用名(目录名)与 dev 端口,展示名缺省为目录名;--name/--port(--title)齐备时跳过交互
 * 2. 拷贝模板并做哨兵替换(哨兵均为合法可编译代码):
 *    - "__APP_NAME__" → 目录名(package.json name、app.manifest.json key)
 *    - "__APP_TITLE__" → 展示名(index.html title、app.manifest.json name)
 *    - "port: 0" → 实际端口(vite.config.ts,全文唯一;漏替换会被 strictPort 快速失败兜住)
 * 3. 写 scaffold.lock.json(模板版本 + 各文件 sha256),供后续模板升级 sync 判定"用户是否改过"
 *
 * 端口纪律:唯一端口源是各 vite.config.ts 的 server.port 字面量;本脚本与 scripts/dev.mjs、
 * scripts/stop.mjs、@repo/config-vite 注册聚合插件共用同一提取规则。
 * 宿主注册表无需登记:apps.ts 经 microAppRegistryPlugin 聚合 manifest,建目录即生效。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const templateRoot = join(repoRoot, "packages/templates/micro-app");
const appsDir = join(repoRoot, "apps");

/** 模板哨兵(与模板内容强耦合,改模板哨兵须同步改此处) */
const NAME_SENTINEL = "__APP_NAME__";
const TITLE_SENTINEL = "__APP_TITLE__";
/** 端口哨兵:模板 vite.config.ts 中全文唯一的合法字面量 */
const PORT_SENTINEL = "port: 0";
/** 端口提取规则(与 dev.mjs / stop.mjs / config-vite 保持一致) */
const PORT_PATTERN = /server:\s*\{[^}]*\bport:\s*(\d+)/;

/**
 * 解析 --name/--port/--title 形态的命令行参数
 * @param argv process.argv.slice(2)
 * @returns flag → value 映射(仅收录已识别的 flag)
 */
function parseArgs(argv) {
  const flags = new Set(["name", "port", "title"]);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    if (flags.has(key) && i + 1 < argv.length) args[key] = argv[++i];
  }
  return args;
}

/**
 * 扫描既有 apps/<name>/vite.config.ts,收集已占用端口
 * @returns 已占用端口集合
 */
function collectUsedPorts() {
  const used = new Set();
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = join(appsDir, entry.name, "vite.config.ts");
    if (!existsSync(configPath)) continue;
    const match = PORT_PATTERN.exec(readFileSync(configPath, "utf8"));
    if (match) used.add(Number(match[1]));
  }
  return used;
}

/**
 * 递归列出目录下全部文件(绝对路径)
 * @param dir 起始目录
 * @returns 文件绝对路径列表
 */
function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/**
 * 目录名合法性:小写 micro- 前缀 + 小写字母/数字/连字符,避免跨平台大小写歧义
 * @param name 待校验目录名
 * @returns 错误信息;合法返回 undefined
 */
function validateName(name) {
  if (!/^micro-[a-z][a-z0-9-]*$/.test(name)) {
    return "须以 micro- 开头,仅含小写字母/数字/连字符(如 micro-app-x)";
  }
  if (existsSync(join(appsDir, name))) return `apps/${name} 已存在`;
  return undefined;
}

/**
 * 端口合法性:整数、1024-65535、未与既有子应用冲突
 * @param raw 用户输入
 * @param used 已占用端口集合
 * @returns 错误信息;合法返回 undefined
 */
function validatePort(raw, used) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return "须为 1024-65535 的整数";
  if (used.has(port)) return `端口 ${port} 已被其他子应用占用`;
  return undefined;
}

p.intro("micro-app 脚手架生成器");

const args = parseArgs(process.argv.slice(2));
const usedPorts = collectUsedPorts();
const suggestedPort = Math.max(7200, ...usedPorts) + 1;

/** 全部非交互参数齐备时跳过 prompts(供脚本化验证与 CI) */
const nonInteractive = Boolean(args.name && args.port);

let name = args.name;
let port = args.port;
let title = args.title;

if (nonInteractive) {
  for (const error of [validateName(name), validatePort(port, usedPorts)]) {
    if (error) {
      p.cancel(error);
      process.exit(1);
    }
  }
  title ??= name;
  p.log.info(`非交互模式:name=${name} port=${port} title=${title}`);
} else {
  name = await s.text({
    message: "子应用目录名(即 package name 与注册表 key)",
    placeholder: "micro-app-new",
    validate: validateName,
  });
  if (p.isCancel(name)) {
    p.cancel("已取消");
    process.exit(0);
  }

  port = await s.text({
    message: "dev 端口(写入 vite.config.ts 的 server.port 字面量)",
    placeholder: String(suggestedPort),
    defaultValue: String(suggestedPort),
    validate: (value) => validatePort(value, usedPorts),
  });
  if (p.isCancel(port)) {
    p.cancel("已取消");
    process.exit(0);
  }

  title = await s.text({
    message: "展示名(Tab 标题与侧栏应用名)",
    placeholder: name,
    defaultValue: name,
  });
  if (p.isCancel(title)) {
    p.cancel("已取消");
    process.exit(0);
  }
}

const appRoot = join(appsDir, name);

// 两阶段生成:先全部渲染 + 校验(哨兵唯一性等),后统一写盘 —— 校验失败不留半成品目录
const templateVersion = JSON.parse(
  readFileSync(join(repoRoot, "packages/templates/package.json"), "utf8"),
).version;
const rendered = [];
const lockFiles = {};

for (const full of walkFiles(templateRoot).sort()) {
  const rel = relative(templateRoot, full).split(sep).join("/");
  let content = readFileSync(full, "utf8")
    .replaceAll(NAME_SENTINEL, name)
    .replaceAll(TITLE_SENTINEL, title);

  if (rel === "vite.config.ts") {
    const sentinelCount = content.split(PORT_SENTINEL).length - 1;
    if (sentinelCount !== 1) {
      s.cancel(`模板 vite.config.ts 的端口哨兵出现 ${sentinelCount} 次(期望 1 次),终止生成`);
      process.exit(1);
    }
    content = content.replace(PORT_SENTINEL, `port: ${port}`);
  }

  rendered.push({ rel, content });
  lockFiles[rel] = createHash("sha256").update(content).digest("hex");
}

let written = 0;
for (const { rel, content } of rendered) {
  mkdirSync(join(appRoot, rel, ".."), { recursive: true });
  writeFileSync(join(appRoot, rel), content);
  written += 1;
}

writeFileSync(
  join(appRoot, "scaffold.lock.json"),
  `${JSON.stringify(
    { template: "@repo/templates/micro-app", templateVersion, files: lockFiles },
    null,
    2,
  )}\n`,
);

p.outro(`已生成 apps/${name}(模板 v${templateVersion},${written} 个文件 + scaffold.lock.json)

后续步骤:
  1. pnpm install                       # 新 workspace 包生效
  2. node scripts/dev.mjs ${name.padEnd(14)}# 直达启动(自动带宿主,打开工作台即可见新 Tab)
  3. 模板升级后运行(规划中):vp run sync`);
