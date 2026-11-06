#!/usr/bin/env node
/**
 * agent-browser 驱动的浏览器 E2E smoke(8 条链路,适配 workspace 布局重设计 v3.1)。
 *
 * 单应用形态:micro-app-demo 是唯一 tab 子应用(micro-app-demo),跨应用保活切换、
 * 多 app 图标导航/浮层菜单场景不再被本 smoke 覆盖;链路 4 的保活切换改为
 * 同应用双 Tab(布局演示 ↔ 表格页,tabKey=app|page 仍为独立保活实例,语义等价)。
 *
 * 用法: node scripts/e2e.mjs   (或仓库根 `vp run e2e`)
 * 前提: 全局安装 agent-browser(>=0.39);缺失时 fail-fast 并给出安装指引。
 *
 * 编排(与 scripts/dev.mjs 既有行为一致):
 *   ① 前置检查 + 会话隔离(AGENT_BROWSER_SESSION=wujie-mvp-e2e)
 *   ② spawn dev.mjs 非 TTY 全启(子应用先于 host 就绪),轮询 host 端口就绪
 *      注意: dev.mjs 端口预检会 stop 掉本仓库残留的 dev 进程,
 *      与手动 dev 并行运行时互杀属预期行为。
 *   ③ 基线重置: 清空 localStorage/sessionStorage 后 reload,
 *      保证 wujie-mvp:theme-custom:v1 / wujie-mvp:tabs:v1 不跨运行残留
 *   ④ 8 条链路: host 侧控件原生 click(无 iframe 覆盖);
 *      子应用侧一律 eval JS click(wujie iframe 覆盖子应用区域,原生点击被
 *      actionability 检查拒绝,实测必须);等待一律 wait --text/--fn,不用固定 sleep;
 *      断言只依赖 eval 返回的 JSON 值(不解析 CLI 文本格式,降低版本漂移风险),
 *      且 eval 表达式内对字段做空值兜底(eval JSON 输出会省略 null 字段)
 *   ⑤ teardown: stop.mjs + agent-browser close(成功失败都执行)
 *
 * 新布局 DOM 契约(v3.1):
 *   .tabs-bar(常驻标签栏)> .tab-item(激活含 .tab-item--active,cold 标记冷实例,
 *   内含 .tab-title/.tab-close);.icon-nav(workspace 图标侧栏)> .nav-item
 *   (每子应用一个);hover 浮层 .nav-popover > .popover-item(data-menu-index,
 *   顺序 = 子应用 menus 数组;mouseenter 触发,.nav-popover--open 强制显示);
 *   .focus-mode(专注模式)/ .breadcrumb / .pane-stage;blank 布局下 .fab 返回、
 *   .tabs-bar v-show 隐藏、.icon-nav 随 workspace 布局组件卸载消失
 *
 * 链路与此前人工批准的「smoke 8 用例」口径映射(实测拆分演化):
 *   8 用例 1(host 加载)   → 链路 1、3
 *   8 用例 2(开 Tab)      → 链路 2
 *   8 用例 3(子应用导航)  → 链路 5
 *   8 用例 5(store 同步)  → 链路 3
 *   8 用例 7(刷新恢复)    → 链路 6
 *   8 用例 8(关 Tab)      → 链路 7
 *   (链路 4 保活为实测补充,覆盖 wujie alive 核心卖点;
 *    链路 8 布局切换为 host layouts 动态布局实测补充;
 *    旧链路 4 暗色切换 / 5 accent 预设 / 7 广播随 UI 重设计移除对应入口后删除)
 */
import { spawn, execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const HOST_URL = "http://localhost:5175";
/** 首次冷启动含依赖重优化,就绪轮询给独立长超时(agent-browser 单命令默认 25s) */
const READY_TIMEOUT_MS = 90_000;

/**
 * 注册表 tab 应用数:与 host 注册聚合同源(apps/<name>/app.manifest.json,过滤 mode=gateway)。
 * 注册表已随 manifest 动态化,断言不再硬编码数量
 * @returns 非 gateway 的注册应用数
 */
function registeredTabAppCount() {
  const appsDir = join(repoRoot, "apps");
  let count = 0;
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(appsDir, entry.name, "app.manifest.json");
    if (!existsSync(manifestPath)) continue;
    if (JSON.parse(readFileSync(manifestPath, "utf8")).mode !== "gateway") count += 1;
  }
  return count;
}

process.env.AGENT_BROWSER_SESSION = "wujie-mvp-e2e";

let failures = 0;
let devProcess = null;

/**
 * 子进程净化环境:剥离 vp run 注入的 fspy 插桩变量。
 * 实测:LD_PRELOAD(fspy ELF)被 Chrome 继承必现 zygote 启动崩溃
 * (zygote_host_impl_linux.cc "Failed to receive hello message");
 * daemon 继承首个 CLI 调用的环境,故所有子进程(含 --version)统一剥离
 */
const CLEAN_ENV = (() => {
  const env = { ...process.env };
  delete env.LD_PRELOAD;
  delete env.DYLD_INSERT_LIBRARIES;
  delete env.FSPY;
  delete env.FSPY_PAYLOAD;
  return env;
})();

/**
 * 以 execFile 执行命令(不经 shell,无引号转义问题;统一使用净化环境)
 *
 * @param {string} cmd 可执行文件
 * @param {string[]} args 参数列表
 * @param {object} [options] 透传 execFile 的选项(覆盖默认值)
 * @returns {Promise<string>} stdout 全文;非零退出时 reject(stderr 优先入错)
 */
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd: repoRoot, timeout: 60_000, env: CLEAN_ENV, ...options },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${cmd} ${args.join(" ")} 失败: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * 执行一条 agent-browser CLI 命令(会话由环境变量统一注入)
 *
 * @param {string[]} args 命令与参数
 * @returns {Promise<string>} stdout 全文
 */
function ab(args) {
  return run("agent-browser", args);
}

/**
 * eval 页面表达式并取回 JSON 值。agent-browser 对 eval 结果按 JSON 序列化输出;
 * 表达式约定只返回「纯对象 + 原始值/布尔字段」(实测: 顶层 JSON 字符串返回会异常)
 *
 * @param {string} expression 在页面上下文求值的 JS 表达式
 * @returns {Promise<Record<string, unknown>>} 解析后的 JSON 值
 */
async function evalJson(expression) {
  const stdout = await ab(["eval", expression]);
  try {
    return JSON.parse(stdout.trim());
  } catch {
    throw new Error(`eval 输出不是合法 JSON: ${stdout.slice(0, 200)}`);
  }
}

/**
 * 等待页面 JS 条件为真(agent-browser 内建轮询,默认 25s 超时)
 *
 * @param {string} expression 页面上下文的布尔表达式
 * @param {string} label 条件描述(超时报错用)
 * @returns {Promise<void>} 条件满足即返回;超时抛错
 */
async function waitFn(expression, label) {
  await ab(["wait", "--fn", expression]).catch((error) => {
    throw new Error(`等待条件超时(${label}): ${error.message}`);
  });
}

/**
 * 等待页面生命周期事件
 *
 * @param {string} phase load / domcontentloaded 等
 * @returns {Promise<void>} 事件到达即返回
 */
async function waitLoad(phase) {
  await ab(["wait", "--load", phase]);
}

/**
 * 打开页面。daemon 冷启动偶发 Chrome zygote 崩溃(Chrome exited early without
 * writing DevToolsActivePort,与 vp run 包装环境相关):先原样重试,
 * 再以 --no-sandbox 兜底(禁用 zygote 沙箱,该错误的经典解法)
 *
 * @param {string} url 目标地址
 * @returns {Promise<void>} 打开成功即返回;三次失败抛错
 */
async function openWithRetry(url) {
  try {
    await ab(["open", url]);
    return;
  } catch {
    await ab(["close", "--all"]).catch(() => {});
    await sleep(1_000);
  }
  try {
    await ab(["open", url]);
    return;
  } catch {
    await ab(["close", "--all"]).catch(() => {});
    await sleep(1_000);
    await ab(["open", "--args", "--no-sandbox", url]);
  }
}

/**
 * 固定延时(仅用于连击去抖,不作为内容等待手段)
 *
 * @param {number} ms 毫秒
 * @returns {Promise<void>} 到时即返回
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 断言(不抛出,累计失败;报告所有断言结果)
 *
 * @param {string} name 断言描述
 * @param {unknown} actual 实际值
 * @param {unknown} expected 期望值
 * @returns {void} 仅产生日志与失败计数副作用
 */
function expect(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    return;
  }
  failures += 1;
  console.error(
    `  ✗ ${name}\n    期望: ${JSON.stringify(expected)}\n    实际: ${JSON.stringify(actual)}`,
  );
}

/**
 * 点击图标导航项。.nav-item 顺序 = 子应用注册表顺序(manifest key 排序),
 * 点击即打开该子应用默认页;host 侧无 iframe 覆盖,原生 click 可用
 *
 * @param {number} index 导航项下标
 * @returns {Promise<Record<string, unknown>>} { clicked: boolean }
 */
function clickNavItem(index) {
  return evalJson(
    `(() => { const nav = document.querySelectorAll('.nav-item')[${index}];` +
      " if (!nav) return { clicked: false };" +
      " nav.click(); return { clicked: true }; })()",
  );
}

/**
 * 展开 .nav-item 浮层并点击指定菜单项。浮层 hover 触发为异步渲染,分三步:
 *   ① eval 先清理遗留的强制 open class(避免误点其他应用残留浮层),
 *      再给目标 .nav-item 派发 mouseenter
 *   ② waitFn 等待目标 popover-item 出现在已展开浮层内
 *      (轮询期间补 .nav-popover--open,防浮层被收起)
 *   ③ eval 点击前再次补 open class(防两次 CLI 往返间收起),保持展开后点击
 *
 * @param {number} navIndex .nav-item 下标(子应用注册表顺序)
 * @param {number} menuIndex 浮层内菜单下标(popover-item 的 data-menu-index)
 * @returns {Promise<Record<string, unknown>>} { clicked: boolean }
 */
async function clickPopoverItem(navIndex, menuIndex) {
  const triggered = await evalJson(
    "(() => { document.querySelectorAll('.nav-popover--open')" +
      ".forEach(p => p.classList.remove('nav-popover--open'));" +
      ` const nav = document.querySelectorAll('.nav-item')[${navIndex}];` +
      " if (!nav) return { ok: false };" +
      " nav.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));" +
      " return { ok: true }; })()",
  );
  if (!triggered.ok) return { clicked: false };
  await waitFn(
    "(() => { const p = [...document.querySelectorAll('.nav-popover')]" +
      ".find(x => x.classList.contains('nav-popover--open'));" +
      " if (p) p.classList.add('nav-popover--open');" +
      ` return !!p && [...p.querySelectorAll('.popover-item')].some(x => x.dataset.menuIndex === '${menuIndex}'); })()`,
    `nav 浮层展开(应用 ${navIndex} 菜单 ${menuIndex})`,
  );
  return evalJson(
    "(() => { const p = [...document.querySelectorAll('.nav-popover')]" +
      ".find(x => x.classList.contains('nav-popover--open'));" +
      " if (!p) return { clicked: false };" +
      " p.classList.add('nav-popover--open');" +
      " const item = [...p.querySelectorAll('.popover-item')]" +
      `.find(x => x.dataset.menuIndex === '${menuIndex}');` +
      " if (!item) return { clicked: false };" +
      " item.click(); return { clicked: true }; })()",
  );
}

/**
 * 点击标题含关键字的 Tab(激活切换;Tab 现为 div role=tab,click 事件等效)
 *
 * @param {string} keyword Tab 标题包含的关键字
 * @returns {Promise<Record<string, unknown>>} { clicked: boolean }
 */
function clickTabByTitle(keyword) {
  return evalJson(
    "(() => { const tab = [...document.querySelectorAll('.tab-item')]" +
      `.find(t => (t.querySelector('.tab-title')?.textContent || '').includes(${JSON.stringify(keyword)}));` +
      " if (!tab) return { clicked: false };" +
      " tab.click(); return { clicked: true }; })()",
  );
}

/**
 * 当前激活 pane 内子应用(shadowRoot)的 JS click;
 * wujie iframe 覆盖子应用区域,原生点击被 actionability 检查拒绝,实测必须 JS click
 *
 * @param {string} predicateSource 元素谓词函数源码(在页面上下文内联求值)
 * @returns {Promise<Record<string, unknown>>} { clicked: boolean }
 */
function jsClickInActiveApp(predicateSource) {
  return evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const el = pane && pane.querySelector('wujie-app');" +
      " const sr = el && el.shadowRoot;" +
      " if (!sr) return { clicked: false };" +
      ` const matches = [ ...sr.querySelectorAll('*') ].filter(${predicateSource});` +
      " const target = matches.at(-1);" +
      " if (!target) return { clicked: false };" +
      " target.click(); return { clicked: true, tag: target.tagName }; })()",
  );
}

/**
 * 等待激活 pane 的子应用 shadowRoot 渲染出指定文本
 *
 * @param {string} keyword 待出现的文本
 * @returns {Promise<void>} 文本出现即返回;超时抛错
 */
function waitAppText(keyword) {
  return waitFn(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const el = pane && pane.querySelector('wujie-app');" +
      " const sr = el && el.shadowRoot;" +
      ` return !!sr && sr.textContent.includes(${JSON.stringify(keyword)}); })()`,
    `子应用渲染 ${keyword}`,
  );
}

/**
 * 轮询 HTTP 端点直到可用(独立于 agent-browser 的就绪检查,覆盖 dev 冷启动)
 *
 * @param {string} url 目标地址
 * @param {number} timeoutMs 超时上限
 * @returns {Promise<void>} 就绪即返回;超时抛错
 */
async function waitHttpReady(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 未就绪,继续轮询
    }
    await sleep(500);
  }
  throw new Error(`等待 ${url} 就绪超时(${timeoutMs}ms)`);
}

/**
 * 后台启动 dev.mjs 并等待 host 与子应用端口就绪
 *
 * @returns {Promise<void>} 各端口就绪即返回;超时抛错
 */
async function startDev() {
  devProcess = spawn("node", ["scripts/dev.mjs"], { cwd: repoRoot, stdio: "ignore" });
  devProcess.on("error", (error) => console.error(`[e2e] dev.mjs 进程异常: ${error.message}`));
  await waitHttpReady(HOST_URL, READY_TIMEOUT_MS);
  // 子应用端口双检(dev.mjs 已保证顺序就绪,此处仅防御;7203 为授权网关,7204 为 micro-app-demo)
  await waitHttpReady("http://localhost:7204", 15_000);
  await waitHttpReady("http://localhost:7203", 15_000);
}

/**
 * 收尾:关闭浏览器会话并停掉 dev 进程(成功失败路径都执行)
 *
 * @returns {Promise<void>} 清理完成即返回;清理失败不抛出(不掩盖主流程结果)
 */
async function teardown() {
  try {
    await ab(["close"]);
  } catch {
    // 浏览器可能已关闭
  }
  if (devProcess) {
    await run("node", ["scripts/stop.mjs"]).catch(() => {});
    devProcess.kill("SIGTERM");
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void teardown().then(() => process.exit(130));
  });
}

/**
 * 前置检查:agent-browser 必须存在(全局 CLI 前提),缺失时给出安装指引并退出
 *
 * @returns {Promise<void>} 检查通过即返回;缺失时 exit 2
 */
async function preflight() {
  let version = "";
  try {
    version = (await run("agent-browser", ["--version"])).trim();
  } catch {
    console.error(
      "[e2e] 未找到 agent-browser,请先安装: npm i -g agent-browser && agent-browser install",
    );
    process.exit(2);
  }
  console.log(`[e2e] agent-browser ${version}`);
}

/**
 * 基线重置:打开 host 后清空 localStorage/sessionStorage 并 reload,
 * 保证 Tab 快照与布局偏好不跨运行残留;清空即未登录,经授权网关登录页
 * 完成 admin 登录,图标导航就绪即视为 host 可交互
 *
 * @returns {Promise<void>} 重置完成且登录后图标导航就绪即返回
 */
async function resetBaseline() {
  await openWithRetry(HOST_URL);
  await waitLoad("load");
  // 冷启动竞态守卫:open/waitLoad 返回时文档可能尚未提交到 host origin
  //(about:blank 上读 localStorage 直接抛 SecurityError),轮询真实文档就绪后再清理
  await waitFn(
    "(() => ({ ok: location.origin === 'http://localhost:5175'" +
      " && document.readyState === 'complete' && !!document.getElementById('app') }))().ok",
    "host 文档就绪(origin/readyState/#app)",
  );
  await evalJson(
    "(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return { cleared: true }; })()",
  );
  await waitLoad("load");
  await loginViaGateway("admin", "123456");
  await waitFn(
    `document.querySelectorAll('.nav-item').length === ${registeredTabAppCount()}`,
    "登录后 host 图标导航就绪",
  );
}

/**
 * 经授权网关登录页完成模拟登录。
 * 登录表单在网关子应用的 wujie shadowRoot 内:JS 填值后派发 input 事件同步 v-model,
 * 提交按钮 JS click(wujie iframe 覆盖,原生点击会被 actionability 检查拒绝,同 jsClickInActiveApp)
 *
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<Record<string, unknown>>} { filled: boolean }
 */
async function loginViaGateway(username, password) {
  await waitFn(
    "(() => { const sr = document.querySelector('wujie-app')?.shadowRoot;" +
      " return !!sr && !!sr.querySelector('#login-username'); })()",
    "授权网关登录页就绪",
  );
  return evalJson(
    "(() => { const sr = document.querySelector('wujie-app')?.shadowRoot;" +
      " const u = sr && sr.querySelector('#login-username');" +
      " const p = sr && sr.querySelector('#login-password');" +
      " const btn = sr && sr.querySelector('button[type=\"submit\"]');" +
      " if (!u || !p || !btn) return { filled: false };" +
      ` u.value = ${JSON.stringify(username)}; u.dispatchEvent(new Event('input', { bubbles: true }));` +
      ` p.value = ${JSON.stringify(password)}; p.dispatchEvent(new Event('input', { bubbles: true }));` +
      " btn.click(); return { filled: true }; })()",
  );
}

/**
 * 链路 1:host 加载与新布局骨架(标签栏/图标导航/面包屑/pane 舞台)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow1HostLoaded() {
  console.log("[链路 1] host 加载与新布局骨架");
  const state = await evalJson(
    "(() => ({ tabsBar: !!document.querySelector('.tabs-bar')," +
      " iconNav: !!document.querySelector('.icon-nav')," +
      " navItems: document.querySelectorAll('.nav-item').length," +
      " breadcrumb: !!document.querySelector('.breadcrumb')," +
      " paneStage: !!document.querySelector('.pane-stage') }))()",
  );
  expect("标签栏 tabs-bar 存在", state.tabsBar, true);
  expect("图标导航 icon-nav 存在", state.iconNav, true);
  expect("导航项 = 注册表 tab 应用数(每子应用一个)", state.navItems, registeredTabAppCount());
  expect("面包屑 breadcrumb 存在", state.breadcrumb, true);
  expect("pane 舞台 pane-stage 存在", state.paneStage, true);
}

/**
 * 链路 2:图标导航开 Tab(micro-app-demo 布局演示):激活态/地址栏自管/标题回报
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow2OpenTab() {
  console.log("[链路 2] 图标导航开 Tab(micro-app-demo 布局演示)");
  const clicked = await clickNavItem(0);
  expect("导航项可点击", clicked.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab-item').length === 1 && !!document.querySelector('.tab-item--active')",
    "Tab 激活",
  );
  await waitAppText("运行状态");
  const state = await evalJson(
    "(() => ({ url: location.pathname," +
      " tabs: document.querySelectorAll('.tab-item').length," +
      " activeHome: (document.querySelector('.tab-item--active .tab-title')?.textContent || '').includes('布局演示')," +
      " title: document.title.includes('测试 Demo') }))()",
  );
  expect("地址栏自管 /micro-app-demo", state.url, "/micro-app-demo");
  expect("Tab 数 = 1", state.tabs, 1);
  expect("激活 Tab 标题含 布局演示", state.activeHome, true);
  expect("document.title 回报生效", state.title, true);
}

/**
 * 链路 3:子应用渲染 + store 同步(props 水合与握手快照均为「管理员」/light)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow3RenderAndSync() {
  console.log("[链路 3] 子应用渲染 + store 同步(props 水合/握手快照)");
  const state = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const el = pane && pane.querySelector('wujie-app');" +
      " const sr = el && el.shadowRoot;" +
      " const text = sr ? sr.textContent : '';" +
      " return { shadow: !!sr, user: text.includes('管理员'), light: text.includes('主题light')," +
      " props: text.includes('运行模式'), share: text.includes('PageContainer 布局验证清单') }; })()",
  );
  expect("wujie shadowRoot 渲染", state.shadow, true);
  expect("props 水合: 用户 管理员", state.user, true);
  expect("握手快照: 主题 light", state.light, true);
  expect("运行模式行存在(props 快照消费)", state.props, true);
  expect("PageContainer(@repo/share)渲染", state.share, true);

  // 容器内滚动:激活 pane 必须是滚动容器(overflow-y auto,防止整页滚动回归)
  const overflow = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " return { overflowY: pane ? getComputedStyle(pane).overflowY : null }; })()",
  );
  expect("激活 pane 为滚动容器(overflow-y auto)", overflow.overflowY, "auto");

  // 探针滚动验证:注入超高元素后 scrollTop 必须生效(内容不超高时 scrollTop 会被钳制为 0,故先垫高)
  const probe = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " if (!pane) return { ok: false };" +
      " const filler = document.createElement('div'); filler.style.height = '3000px';" +
      " pane.appendChild(filler);" +
      " pane.scrollTop = 100; const scrolled = pane.scrollTop;" +
      " pane.removeChild(filler); pane.scrollTop = 0;" +
      " return { ok: true, scrolled }; })()",
  );
  expect("pane 滚动生效(探针 scrollTop=100)", probe.scrolled, 100);
}

/**
 * 链路 4:保活(计数 3 → 浮层菜单切表格页 → 切回计数保留;同应用双 Tab,
 * tabKey=app|page,仍为独立保活实例)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow4KeepAlive() {
  console.log("[链路 4] 保活(计数 → 切走 → 切回保留)");
  for (let i = 0; i < 3; i += 1) {
    const clicked = await jsClickInActiveApp(
      "el => el.tagName === 'BUTTON' && el.textContent.trim() === '+1'",
    );
    if (!clicked.clicked) throw new Error("未找到子应用 +1 按钮");
    await sleep(120);
  }
  await waitFn(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " if (!sr) return false; const m = sr.textContent.match(/(\\d+)\\s*\\+1/);" +
      " return !!m && m[1] === '3'; })()",
    "计数到达 3",
  );
  const toTable = await clickPopoverItem(0, 1);
  expect("浮层菜单切到 表格页 Tab", toTable.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab-item').length === 2 && location.pathname === '/micro-app-demo/table'",
    "表格页 Tab 激活",
  );
  await waitAppText("查 询");
  const back = await clickTabByTitle("布局演示");
  expect("切回布局演示 Tab", back.clicked, true);
  await waitFn("location.pathname === '/micro-app-demo'", "切回就绪");
  const counter = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " const m = sr ? sr.textContent.match(/(\\d+)\\s*\\+1/) : null;" +
      " return { value: m ? Number(m[1]) : -1 }; })()",
  );
  expect("保活: 切回后计数保留 3", counter.value, 3);
}

/**
 * 链路 5:子应用内导航 → tabOpen 新开 Tab(智能手表 Pro #101)
 * 入口改走图标导航浮层(micro-app-demo 图标 → data-menu-index=3 「产品」)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow5TabOpen() {
  console.log("[链路 5] 子应用内导航 → tabOpen 新开 Tab");
  const toProducts = await clickPopoverItem(0, 3);
  expect("浮层菜单打开 micro-app-demo 产品 Tab", toProducts.clicked, true);
  await waitFn("location.pathname === '/micro-app-demo/products'", "产品 Tab 激活");
  await waitAppText("产品列表");
  const clicked = await jsClickInActiveApp(
    "el => (el.tagName === 'BUTTON' && (el.textContent || '').trim().startsWith('智能手表 Pro'))",
  );
  expect("点击产品 智能手表 Pro", clicked.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab-item').length === 4 && location.pathname === '/micro-app-demo/products/101'" +
      " && [...document.querySelectorAll('.tab-title')].some(t => (t.textContent || '').includes('智能手表 Pro #101'))",
    "新 Tab 打开且标题回报",
  );
  const state = await evalJson(
    "(() => ({ tabs: document.querySelectorAll('.tab-item').length, url: location.pathname," +
      " newTab: [...document.querySelectorAll('.tab-title')].some(t => (t.textContent || '').includes('智能手表 Pro #101')) }))()",
  );
  expect("Tab 数 = 4", state.tabs, 4);
  expect("地址栏 /micro-app-demo/products/101", state.url, "/micro-app-demo/products/101");
  expect("新 Tab 标题回报 智能手表 Pro #101", state.newTab, true);
}

/**
 * 链路 6:刷新恢复(sessionStorage 恢复 cold Tab + 激活项重建实例并渲染)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow6RefreshRestore() {
  console.log("[链路 6] 刷新恢复(sessionStorage → cold → 激活重建)");
  await openWithRetry(`${HOST_URL}/micro-app-demo/products/101`);
  await waitLoad("load");
  await waitFn(
    "(() => { const t = document.querySelector('.tab-item--active');" +
      " return !!t && !t.classList.contains('cold'); })()",
    "激活 Tab 重建完成",
  );
  await waitAppText("智能手表 Pro");
  const state = await evalJson(
    "(() => ({ total: document.querySelectorAll('.tab-item').length," +
      " cold: document.querySelectorAll('.tab-item.cold').length," +
      " activeNotCold: (() => { const t = document.querySelector('.tab-item--active');" +
      " return !!t && !t.classList.contains('cold'); })()," +
      " url: location.pathname," +
      " detail: (() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return !!sr && sr.textContent.includes('¥1299'); })() }))()",
  );
  expect("恢复 Tab 数 = 4", state.total, 4);
  expect("非激活 Tab 落 cold = 3", state.cold, 3);
  expect("激活 Tab 已重建(非 cold)", state.activeNotCold, true);
  expect("地址栏直达恢复 /micro-app-demo/products/101", state.url, "/micro-app-demo/products/101");
  expect("详情页内容渲染(¥1299)", state.detail, true);
}

/**
 * 链路 7:关闭激活 Tab → 左邻 Tab 接管激活且地址栏同步
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow7CloseTab() {
  console.log("[链路 7] 关闭激活 Tab → 相邻接管");
  const closed = await evalJson(
    "(() => { const active = document.querySelector('.tab-item--active');" +
      " const close = active && active.querySelector('.tab-close');" +
      " if (!close) return { clicked: false }; close.click(); return { clicked: true }; })()",
  );
  expect("关闭按钮可点击", closed.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab-item').length === 3 && location.pathname === '/micro-app-demo/products'",
    "相邻 Tab 接管",
  );
  const state = await evalJson(
    "(() => ({ total: document.querySelectorAll('.tab-item').length, url: location.pathname," +
      " activeProduct: (document.querySelector('.tab-item--active .tab-title')?.textContent || '').includes('产品') }))()",
  );
  expect("Tab 数 = 3", state.total, 3);
  expect("地址栏同步 /micro-app-demo/products", state.url, "/micro-app-demo/products");
  expect("左邻 产品 Tab 接管激活", state.activeProduct, true);
}

/**
 * 链路 8:layouts 动态布局(workspace ↔ blank)
 * chrome 层切换(icon-nav 随 workspace 布局卸载/tabs-bar v-show 隐藏/fab 挂载),
 * wujie 容器层常驻:保活实例穿越布局切换与 blank 下刷新不重载,
 * 布局偏好 localStorage 持久化跨刷新恢复
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow8LayoutSwitch() {
  console.log("[链路 8] 布局切换(workspace ↔ blank)+ 保活 + 持久化");
  // flow7 刚把激活权交给 cold 的产品 Tab:实例异步重建中,先等渲染就绪再切布局
  await waitAppText("产品列表");
  const toBlank = await evalJson(
    "(() => { const btn = document.querySelector('.focus-mode');" +
      " if (!btn) return { clicked: false }; btn.click(); return { clicked: true }; })()",
  );
  expect("专注模式按钮可点击", toBlank.clicked, true);
  await waitFn(
    "!document.querySelector('.icon-nav') && !!document.querySelector('.fab')" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'blank'",
    "切换到 blank(icon-nav 卸载、浮动按钮挂载、偏好落盘)",
  );
  const blankState = await evalJson(
    "(() => { const bar = document.querySelector('.tabs-bar');" +
      " const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return { tabsBarHidden: !!bar && getComputedStyle(bar).display === 'none'," +
      " iconNavGone: !document.querySelector('.icon-nav')," +
      " tabs: document.querySelectorAll('.tab-item').length," +
      " alive: !!sr && sr.textContent.includes('产品列表') }; })()",
  );
  expect("tabs-bar 隐藏(v-show,按计算样式)", blankState.tabsBarHidden, true);
  expect("icon-nav 随 workspace 布局卸载", blankState.iconNavGone, true);
  expect("Tab 列表穿越布局切换保留", blankState.tabs, 3);
  expect("保活实例仍在渲染(产品列表)", blankState.alive, true);

  // blank 下刷新:布局偏好持久化恢复,Tab 会话照常恢复 + 激活实例重建
  await openWithRetry(`${HOST_URL}/micro-app-demo/products`);
  await waitLoad("load");
  await waitFn(
    "!!document.querySelector('.fab') && !document.querySelector('.icon-nav')" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'blank'",
    "刷新后保持 blank 布局",
  );
  await waitFn(
    "(() => { const t = document.querySelector('.tab-item--active');" +
      " return document.querySelectorAll('.tab-item').length === 3 && !!t && !t.classList.contains('cold'); })()",
    "blank 下刷新 Tab 恢复且激活实例重建",
  );
  await waitAppText("产品列表");

  // hit-test:fab 中心点必须命中按钮自身(而非覆盖层)——eval JS click 不做 hit-test,
  // 无法发现 pane-area 等 absolute 层遮挡 fab 的回归,这里程序化验证真实鼠标路径
  const fabHit = await evalJson(
    "(() => { const fab = document.querySelector('.fab');" +
      " if (!fab) return { hit: false, target: 'missing' };" +
      " const r = fab.getBoundingClientRect();" +
      " const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);" +
      " return { hit: !!el && (el === fab || fab.contains(el))," +
      " target: el ? el.tagName.toLowerCase() + '.' + (el.className.baseVal ?? el.className) : null }; })()",
  );
  expect("返回工作台按钮未被遮挡(hit-test)", fabHit.hit, true);

  const backToWorkspace = await evalJson(
    "(() => { const fab = document.querySelector('.fab');" +
      " if (!fab) return { clicked: false }; fab.click(); return { clicked: true }; })()",
  );
  expect("返回工作台按钮可点击", backToWorkspace.clicked, true);
  await waitFn(
    "!!document.querySelector('.icon-nav')" +
      " && (() => { const bar = document.querySelector('.tabs-bar'); return !!bar && getComputedStyle(bar).display !== 'none'; })()" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'workspace'",
    "切回 workspace(icon-nav 挂载、tabs-bar 恢复)",
  );
}

/**
 * 主流程:前置检查 → 启动 dev → 基线重置 → 顺序执行 8 条链路 → 汇总
 *
 * @returns {Promise<void>} 进程退出码由断言结果决定(0/1)
 */
async function main() {
  await preflight();
  console.log("[e2e] 启动 dev(child: micro-app-demo/micro-auth → micro-host)…");
  await startDev();
  console.log("[e2e] dev 就绪,重置浏览器基线…");
  await resetBaseline();

  await flow1HostLoaded();
  await flow2OpenTab();
  await flow3RenderAndSync();
  await flow4KeepAlive();
  await flow5TabOpen();
  await flow6RefreshRestore();
  await flow7CloseTab();
  await flow8LayoutSwitch();

  if (failures > 0) {
    console.error(`\n[e2e] 结果: ${failures} 个断言失败`);
    process.exitCode = 1;
    return;
  }
  console.log("\n[e2e] 结果: 8 条链路全部通过");
}

try {
  await main();
} catch (error) {
  console.error(`\n[e2e] 中止: ${error.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
