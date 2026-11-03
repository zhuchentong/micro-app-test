#!/usr/bin/env node
/**
 * agent-browser 驱动的浏览器 E2E smoke(11 条链路)。
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
 *   ④ 11 条链路: host 侧控件原生 click(无 iframe 覆盖);
 *      子应用侧一律 eval JS click(wujie iframe 覆盖子应用区域,原生点击被
 *      actionability 检查拒绝,实测必须);等待一律 wait --text/--fn,不用固定 sleep;
 *      断言只依赖 eval 返回的 JSON 值(不解析 CLI 文本格式,降低版本漂移风险),
 *      且 eval 表达式内对字段做空值兜底(eval JSON 输出会省略 null 字段)
 *   ⑤ teardown: stop.mjs + agent-browser close(成功失败都执行)
 *
 * 链路与此前人工批准的「smoke 8 用例」口径映射(实测拆分演化):
 *   8 用例 1(host 加载)   → 链路 1、3
 *   8 用例 2(开 Tab)      → 链路 2
 *   8 用例 3(子应用导航)  → 链路 8
 *   8 用例 4(主题切换)    → 链路 4、5
 *   8 用例 5(store 同步)  → 链路 3
 *   8 用例 6(广播)        → 链路 7
 *   8 用例 7(刷新恢复)    → 链路 9
 *   8 用例 8(关 Tab)      → 链路 10
 *   (链路 6 保活为实测补充,覆盖 wujie alive 核心卖点;
 *    链路 11 布局切换为 host layouts 动态布局实测补充)
 */
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const HOST_URL = "http://localhost:5175";
const BROADCAST_TEXT = "hello-wujie-broadcast";
/** 首次冷启动含依赖重优化,就绪轮询给独立长超时(agent-browser 单命令默认 25s) */
const READY_TIMEOUT_MS = 90_000;

process.env.AGENT_BROWSER_SESSION = "wujie-mvp-e2e";

let failures = 0;
let devProcess = null;

/**
 * 以 execFile 执行命令(不经 shell,无引号转义问题)
 *
 * @param {string} cmd 可执行文件
 * @param {string[]} args 参数列表
 * @param {object} [options] 透传 execFile 的选项
 * @returns {Promise<string>} stdout 全文;非零退出时 reject(stderr 优先入错)
 */
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
 * 点击 host 侧栏菜单。.app-group 顺序 = apps 注册表顺序(sub-a, sub-b),
 * menu-item 顺序 = 各应用菜单数组顺序
 *
 * @param {number} groupIndex 应用分组下标
 * @param {number} menuIndex 分组内菜单下标
 * @returns {Promise<Record<string, unknown>>} { clicked: boolean }
 */
function clickMenuItem(groupIndex, menuIndex) {
  return evalJson(
    `(() => { const g = document.querySelectorAll('.app-group')[${groupIndex}];` +
      ` const btn = g && g.querySelectorAll('.menu-item')[${menuIndex}];` +
      " if (!btn) return { clicked: false };" +
      " btn.click(); return { clicked: true }; })()",
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
    "(() => { const tab = [...document.querySelectorAll('.tab')]" +
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
 * 当前激活 pane 子应用 shadowRoot 是否包含指定文本
 * (内容检查在页面内完成,只回传布尔,规避 eval JSON 的 null 字段省略)
 *
 * @param {string} keyword 待检查文本
 * @returns {Promise<boolean>} 包含为 true
 */
function activeAppTextIncludes(keyword) {
  return evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const el = pane && pane.querySelector('wujie-app');" +
      " const sr = el && el.shadowRoot;" +
      ` return !!sr && sr.textContent.includes(${JSON.stringify(keyword)}); })()`,
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
 * 读取根元素 CSS 变量当前值(host 是唯一写入方,变量经继承穿透子应用)
 *
 * @param {string} name 变量名(如 --app-accent)
 * @returns {Promise<string>} trim 后的变量值;未设置时为空串
 */
async function cssVar(name) {
  const state = await evalJson(
    `(() => ({ value: getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(name)}).trim() }))()`,
  );
  return state.value ?? "";
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
 * 后台启动 dev.mjs 并等待 host 与两个子应用端口就绪
 *
 * @returns {Promise<void>} 三端口就绪即返回;超时抛错
 */
async function startDev() {
  devProcess = spawn("node", ["scripts/dev.mjs"], { cwd: repoRoot, stdio: "ignore" });
  devProcess.on("error", (error) => console.error(`[e2e] dev.mjs 进程异常: ${error.message}`));
  await waitHttpReady(HOST_URL, READY_TIMEOUT_MS);
  // 子应用端口双检(dev.mjs 已保证顺序就绪,此处仅防御)
  await waitHttpReady("http://localhost:7201", 15_000);
  await waitHttpReady("http://localhost:7202", 15_000);
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
 * 保证主题自定义 token 与 Tab 快照不跨运行残留
 *
 * @returns {Promise<void>} 重置完成且侧栏就绪即返回
 */
async function resetBaseline() {
  await openWithRetry(HOST_URL);
  await waitLoad("load");
  await evalJson(
    "(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); return { cleared: true }; })()",
  );
  await waitLoad("load");
  await waitFn("document.querySelectorAll('.menu-item').length === 4", "host 侧栏就绪");
}

/**
 * 链路 1:host 加载与侧栏结构(品牌/分组/菜单/主题/广播/日志)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow1HostLoaded() {
  console.log("[链路 1] host 加载与侧栏结构");
  const state = await evalJson(
    "(() => ({ groups: document.querySelectorAll('.app-group').length," +
      " menus: document.querySelectorAll('.menu-item').length," +
      " brand: !!document.querySelector('.brand')," +
      " themeToggle: !!document.querySelector('.theme-toggle')," +
      " broadcast: !!document.querySelector('.broadcast input')," +
      " logs: !!document.querySelector('.logs') }))()",
  );
  expect("应用分组 = 2", state.groups, 2);
  expect("菜单项 = 4", state.menus, 4);
  expect("品牌标题存在", state.brand, true);
  expect("主题切换存在", state.themeToggle, true);
  expect("广播输入存在", state.broadcast, true);
  expect("消息日志存在", state.logs, true);
}

/**
 * 链路 2:菜单开 Tab(sub-a 首页):激活态/地址栏自管/标题回报
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow2OpenTab() {
  console.log("[链路 2] 菜单开 Tab(sub-a 首页)");
  const clicked = await clickMenuItem(0, 0);
  expect("菜单可点击", clicked.clicked, true);
  await waitFn("document.querySelectorAll('.tab.active').length === 1", "Tab 激活");
  await waitAppText("实时状态");
  const state = await evalJson(
    "(() => ({ url: location.pathname," +
      " tabs: document.querySelectorAll('.tab').length," +
      " activeHome: (document.querySelector('.tab.active .tab-title')?.textContent || '').includes('首页')," +
      " title: document.title.includes('子应用 A') }))()",
  );
  expect("地址栏自管 /sub-a", state.url, "/sub-a");
  expect("Tab 数 = 1", state.tabs, 1);
  expect("激活 Tab 标题含 首页", state.activeHome, true);
  expect("document.title 回报生效", state.title, true);
}

/**
 * 链路 3:子应用渲染 + store 同步(props 水合与握手快照均为「宿主张三」/light)
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
      " return { shadow: !!sr, user: text.includes('宿主张三'), light: text.includes('主题light')," +
      " props: text.includes('主应用注入的 props'), share: text.includes('@repo/share') }; })()",
  );
  expect("wujie shadowRoot 渲染", state.shadow, true);
  expect("props 水合: 用户 宿主张三", state.user, true);
  expect("握手快照: 主题 light", state.light, true);
  expect("props 快照区存在", state.props, true);
  expect("共享组件 @repo/share 正常", state.share, true);
}

/**
 * 链路 4:暗色切换(--app-bg-page 变量变化 + 子应用 store 实时 dark)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow4DarkTheme() {
  console.log("[链路 4] 暗色切换(CSS 变量 + 子应用同步)");
  const before = await cssVar("--app-bg-page");
  expect("切换前为亮色 #edf4f9", before, "#edf4f9");
  await evalJson(
    "(() => { document.querySelector('.theme-toggle').click(); return { clicked: true }; })()",
  );
  await waitFn(
    "getComputedStyle(document.documentElement).getPropertyValue('--app-bg-page').trim() !== '#edf4f9'",
    "暗色变量生效",
  );
  const state = await evalJson(
    "(() => ({ bg: getComputedStyle(document.documentElement).getPropertyValue('--app-bg-page').trim()," +
      " subDark: (() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return !!sr && sr.textContent.includes('主题dark'); })() }))()",
  );
  expect("切换后 --app-bg-page = #0b1e2c", state.bg, "#0b1e2c");
  expect("子应用 store 同步 dark", state.subDark, true);
}

/**
 * 链路 5:accent 预设(绿)+ 自定义 token 成组持久化到 localStorage
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow5AccentPreset() {
  console.log("[链路 5] accent 预设(绿) + 自定义 token 持久化");
  await evalJson(
    "(() => { const dot = [...document.querySelectorAll('.accent-dot')].find(b => b.title === '绿');" +
      " if (!dot) return { clicked: false }; dot.click(); return { clicked: true }; })()",
  );
  await waitFn(
    "getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() === '#059669'",
    "accent 变量生效",
  );
  const state = await evalJson(
    "(() => { let keys = 0;" +
      " try { keys = Object.keys(JSON.parse(localStorage.getItem('wujie-mvp:theme-custom:v1') || '{}')).length; } catch { keys = -1; }" +
      " return { accent: getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim(), keys }; })()",
  );
  expect("accent = #059669", state.accent, "#059669");
  expect("4 个成组 token 持久化", state.keys, 4);
}

/**
 * 链路 6:保活(计数 3 → 切 sub-b → 切回计数保留)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow6KeepAlive() {
  console.log("[链路 6] 保活(计数 → 切走 → 切回保留)");
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
  const toSubB = await clickMenuItem(1, 1);
  expect("切到 sub-b 通信演示", toSubB.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab').length === 2 && location.pathname === '/sub-b/about'",
    "sub-b Tab 激活",
  );
  await waitAppText("通信演示");
  const back = await clickTabByTitle("首页");
  expect("切回 sub-a 首页 Tab", back.clicked, true);
  await waitFn("location.pathname === '/sub-a'", "切回就绪");
  const counter = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " const m = sr ? sr.textContent.match(/(\\d+)\\s*\\+1/) : null;" +
      " return { value: m ? Number(m[1]) : -1 }; })()",
  );
  expect("保活: 切回后计数保留 3", counter.value, 3);
}

/**
 * 链路 7:host 广播 → sub-b 通信演示页接收(host:state 用户同步一并断言)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow7Broadcast() {
  console.log("[链路 7] host 广播 → sub-b 通信演示页接收");
  const toSubB = await clickMenuItem(1, 1);
  expect("激活 sub-b 通信演示 Tab", toSubB.clicked, true);
  await waitFn("location.pathname === '/sub-b/about'", "sub-b 激活");
  await ab(["fill", 'input[aria-label="广播内容"]', BROADCAST_TEXT]);
  await evalJson(
    "(() => { document.querySelector('.broadcast button').click(); return { sent: true }; })()",
  );
  await waitFn(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      ` return !!sr && sr.textContent.includes('收到: ${BROADCAST_TEXT}'); })()`,
    "sub-b 收到广播",
  );
  expect("sub-b 显示广播内容", await activeAppTextIncludes(`收到: ${BROADCAST_TEXT}`), true);
  expect("sub-b 页面含同步用户", await activeAppTextIncludes("宿主张三"), true);
}

/**
 * 链路 8:子应用内导航 → tabOpen 新开 Tab(智能手表 Pro #101)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow8TabOpen() {
  console.log("[链路 8] 子应用内导航 → tabOpen 新开 Tab");
  const toProducts = await clickMenuItem(0, 1);
  expect("打开 sub-a 产品 Tab", toProducts.clicked, true);
  await waitFn("location.pathname === '/sub-a/products'", "产品 Tab 激活");
  await waitAppText("产品列表");
  const clicked = await jsClickInActiveApp(
    "el => (el.children.length <= 3 && (el.textContent || '').trim().startsWith('智能手表 Pro'))",
  );
  expect("点击产品 智能手表 Pro", clicked.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab').length === 4 && location.pathname === '/sub-a/product/101'" +
      " && [...document.querySelectorAll('.tab-title')].some(t => (t.textContent || '').includes('智能手表 Pro #101'))",
    "新 Tab 打开且标题回报",
  );
  const state = await evalJson(
    "(() => ({ tabs: document.querySelectorAll('.tab').length, url: location.pathname," +
      " newTab: [...document.querySelectorAll('.tab-title')].some(t => (t.textContent || '').includes('智能手表 Pro #101')) }))()",
  );
  expect("Tab 数 = 4", state.tabs, 4);
  expect("地址栏 /sub-a/product/101", state.url, "/sub-a/product/101");
  expect("新 Tab 标题回报 智能手表 Pro #101", state.newTab, true);
}

/**
 * 链路 9:刷新恢复(sessionStorage 恢复 cold Tab + 激活项重建实例并渲染)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow9RefreshRestore() {
  console.log("[链路 9] 刷新恢复(sessionStorage → cold → 激活重建)");
  await openWithRetry(`${HOST_URL}/sub-a/product/101`);
  await waitLoad("load");
  await waitFn(
    "(() => { const t = document.querySelector('.tab.active');" +
      " return !!t && t.classList.contains('cold') === false; })()",
    "激活 Tab 重建完成",
  );
  await waitAppText("智能手表 Pro");
  const state = await evalJson(
    "(() => ({ total: document.querySelectorAll('.tab').length," +
      " cold: document.querySelectorAll('.tab.cold').length," +
      " activeNotCold: (() => { const t = document.querySelector('.tab.active');" +
      " return !!t && !t.classList.contains('cold'); })()," +
      " url: location.pathname," +
      " detail: (() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return !!sr && sr.textContent.includes('¥1299'); })() }))()",
  );
  expect("恢复 Tab 数 = 4", state.total, 4);
  expect("非激活 Tab 落 cold = 3", state.cold, 3);
  expect("激活 Tab 已重建(非 cold)", state.activeNotCold, true);
  expect("地址栏直达恢复 /sub-a/product/101", state.url, "/sub-a/product/101");
  expect("详情页内容渲染(¥1299)", state.detail, true);
}

/**
 * 链路 10:关闭激活 Tab → 左邻 Tab 接管激活且地址栏同步
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow10CloseTab() {
  console.log("[链路 10] 关闭激活 Tab → 相邻接管");
  const closed = await evalJson(
    "(() => { const active = document.querySelector('.tab.active');" +
      " const close = active && active.querySelector('.tab-close');" +
      " if (!close) return { clicked: false }; close.click(); return { clicked: true }; })()",
  );
  expect("关闭按钮可点击", closed.clicked, true);
  await waitFn(
    "document.querySelectorAll('.tab').length === 3 && location.pathname === '/sub-a/products'",
    "相邻 Tab 接管",
  );
  const state = await evalJson(
    "(() => ({ total: document.querySelectorAll('.tab').length, url: location.pathname," +
      " activeProduct: (document.querySelector('.tab.active .tab-title')?.textContent || '').includes('产品') }))()",
  );
  expect("Tab 数 = 3", state.total, 3);
  expect("地址栏同步 /sub-a/products", state.url, "/sub-a/products");
  expect("左邻 产品 Tab 接管激活", state.activeProduct, true);
}

/**
 * 链路 11:layouts 动态布局(workspace ↔ blank)
 * chrome 层切换(sider 卸载/浮动按钮挂载),wujie 容器层常驻:
 * 保活实例穿越布局切换与 blank 下刷新不重载,布局偏好 localStorage 持久化跨刷新恢复
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow11LayoutSwitch() {
  console.log("[链路 11] 布局切换(workspace ↔ blank)+ 保活 + 持久化");
  // flow10 刚把激活权交给 cold 的产品 Tab:实例异步重建中,先等渲染就绪再切布局
  await waitAppText("产品列表");
  const toBlank = await evalJson(
    "(() => { const btn = document.querySelector('.focus-mode');" +
      " if (!btn) return { clicked: false }; btn.click(); return { clicked: true }; })()",
  );
  expect("专注模式按钮可点击", toBlank.clicked, true);
  await waitFn(
    "!document.querySelector('.sider') && !!document.querySelector('.fab')" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'blank'",
    "切换到 blank(sider 卸载、浮动按钮挂载、偏好落盘)",
  );
  const blankState = await evalJson(
    "(() => { const bar = document.querySelector('.tabs-bar');" +
      " const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return { tabsBarHidden: !!bar && bar.style.display === 'none'," +
      " tabs: document.querySelectorAll('.tab').length," +
      " alive: !!sr && sr.textContent.includes('产品列表') }; })()",
  );
  expect("tabs-bar 隐藏(v-show)", blankState.tabsBarHidden, true);
  expect("Tab 列表穿越布局切换保留", blankState.tabs, 3);
  expect("保活实例仍在渲染(产品列表)", blankState.alive, true);

  // blank 下刷新:布局偏好持久化恢复,Tab 会话照常恢复 + 激活实例重建
  await openWithRetry(`${HOST_URL}/sub-a/products`);
  await waitLoad("load");
  await waitFn(
    "!!document.querySelector('.fab') && !document.querySelector('.sider')" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'blank'",
    "刷新后保持 blank 布局",
  );
  await waitFn(
    "(() => { const t = document.querySelector('.tab.active');" +
      " return document.querySelectorAll('.tab').length === 3 && !!t && !t.classList.contains('cold'); })()",
    "blank 下刷新 Tab 恢复且激活实例重建",
  );
  await waitAppText("产品列表");

  const backToWorkspace = await evalJson(
    "(() => { const fab = document.querySelector('.fab');" +
      " if (!fab) return { clicked: false }; fab.click(); return { clicked: true }; })()",
  );
  expect("返回工作台按钮可点击", backToWorkspace.clicked, true);
  await waitFn(
    "!!document.querySelector('.sider')" +
      " && (() => { const bar = document.querySelector('.tabs-bar'); return !!bar && bar.style.display !== 'none'; })()" +
      " && localStorage.getItem('wujie-mvp:layout:v1') === 'workspace'",
    "切回 workspace(sider 挂载、tabs-bar 恢复)",
  );
}

/**
 * 主流程:前置检查 → 启动 dev → 基线重置 → 顺序执行 11 条链路 → 汇总
 *
 * @returns {Promise<void>} 进程退出码由断言结果决定(0/1)
 */
async function main() {
  await preflight();
  console.log("[e2e] 启动 dev(child: sub-app-a/sub-app-b → host)…");
  await startDev();
  console.log("[e2e] dev 就绪,重置浏览器基线…");
  await resetBaseline();

  await flow1HostLoaded();
  await flow2OpenTab();
  await flow3RenderAndSync();
  await flow4DarkTheme();
  await flow5AccentPreset();
  await flow6KeepAlive();
  await flow7Broadcast();
  await flow8TabOpen();
  await flow9RefreshRestore();
  await flow10CloseTab();
  await flow11LayoutSwitch();

  if (failures > 0) {
    console.error(`\n[e2e] 结果: ${failures} 个断言失败`);
    process.exitCode = 1;
    return;
  }
  console.log("\n[e2e] 结果: 11 条链路全部通过");
}

try {
  await main();
} catch (error) {
  console.error(`\n[e2e] 中止: ${error.message}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
