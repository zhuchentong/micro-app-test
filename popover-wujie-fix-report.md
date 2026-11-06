# @tu-design/vue Popover wujie 微前端适配问题报告

> 实测版本：`@tu-design/vue@0.5.2`（registry popover item）
> 复现环境：本仓库 wujie 工作台（micro-host 5175 + micro-app-demo 7204，wujie alive 模式，
> 子应用 DOM 由 wujie graft 进 `wujie-app` shadowRoot 渲染）
> 复现路径：登录 → 图标导航打开「测试 Demo」→ 点击「打开 Popover」
> 现象截图：面板未锚定触发器，出现在页面深处偏左下（误翻转 + 容器偏移叠加）

---

## 0.5.3 实测结论（2026-11-04 更新，已在 glass 工作台复测）

**0.5.3 修复有效，全链路通过**：`isInWujie` 检测 → 面板落 `#app` 容器 ✓；
`isInIframeRealm` → `strategy: fixed` ✓；视口 1440×900 下 gap=9、`--y=641`（=触发器
bottom 632.5 + gutter 8.5）、xCenterOff=0 像素级锚定 ✓；host 侧 body/absolute 回归 ✓；
check/69 tests/5 apps build 全绿。

**对问题 3 归因的修正**：本仓库进一步实测发现 wujie 同步的 iframe `innerHeight` 与
主视口**一致**（577=577，同步的是视口尺寸而非容器尺寸），flip 判定空间并未错位——
0.5.2 用户环境的偏移主因即问题 2（absolute 包含块错位），flip 在触发器位于视口上部时
根本不触发。复测时矮窗口（577px）下深位触发器（bottom 633>577）翻转到 top 属**正常
碰撞行为**（触发器真超视口，翻入视口内反而可见）。上游 0.5.3 不关 flip 的选择正确，
无需再调整。

---

## 问题 1（阻断）：shadow DOM 检测在 wujie 下永不命中 → 面板落入 iframe body

### 现象

面板 Teleport 目标解析为默认 `body`（子应用 realm 的 body = **wujie iframe 的真实 body**），
而非 0.5.2 注释所声称的"shadow DOM 沙箱自动降级为应用挂载容器"。

### 机制

wujie 的渲染模型是把 iframe 文档树 **graft 进 shadowRoot**（`shadowRoot.children === [<html>]`）。
关键实测：**graft 前后，容器元素的 `getRootNode()` 都返回 `HTMLDocument` 而非 `ShadowRoot`**
——graft 的树保留 iframe document 身份（Node 树的 root 语义被 wujie 的移植方式改变）。
因此 `container.getRootNode() instanceof ShadowRoot` 这条检测路径在 wujie 下**结构性失效**，
不是时序问题（mount 后微任务检测同样拿到 `HTMLDocument`）。

### 实测证据（主 frame eval）

```js
// 面板归属（修复前）
document.querySelector("wujie-app").shadowRoot.querySelector("[role=dialog]");
// → 命中,但 parentElement 链: content → popper → BODY → HTML（iframe 文档的 body）
// iframe.contentDocument.body.children 含 DIV.z-[var(--z-overlay)]（positioner 直挂 iframe body）
iframe.contentWindow.__POWERED_BY_WUJIE__ === true; // 标记稳定存在
sr.querySelector("#app").getRootNode().constructor.name === "HTMLDocument"; // graft 后依旧
```

### 修复建议

叠加 `window.__POWERED_BY_WUJIE__` 标记（wujie 在子应用代码执行前注入 iframe realm，时序可靠）：

```ts
const inWujie =
  typeof window !== "undefined" &&
  (window as { __POWERED_BY_WUJIE__?: boolean }).__POWERED_BY_WUJIE__ === true;
// 检测条件:
if (container && (container.getRootNode() instanceof ShadowRoot || inWujie)) {
  detectedTarget.value = container;
}
```

---

## 问题 2（偏移来源之一）：absolute 策略坐标空间错位

### 机制

zag popper 默认 `strategy: "absolute"`，floating-ui 按**视口空间**产出坐标；
但面板 Teleport 后渲染在 graft 树内，其 CSS 包含块/渲染原点是**容器位置**（= pane 在主页面
的偏移），两者差一个容器偏移 → 面板必偏移。

### 实测证据

```
positioner inline: --x: 60px; --y: 529px（视口系）
面板实际渲染 rect: (162, 659) = pane 原点 (102, 130) + (60, 529)
→ x/y 各偏移 102/130，恰为容器在主页面的偏移
```

### 修复建议

沙箱内强制 `strategy: "fixed"`（fixed 以视口为包含块，与 zag 出坐标的空间一致）；
用户显式传入 `positioning.strategy` 时以其为准。

---

## 问题 3（偏移来源之二、误翻转）：flip 边界用 iframe 尺寸判定主视口

### 机制

wujie 把 iframe window 的 `innerHeight/innerWidth` 同步为**容器尺寸**（实测 577 / 1264），
而元素 `getBoundingClientRect()` 返回的是**主页面视觉坐标**。floating-ui 的翻转边界
（overflow 检测）用 `innerHeight` 判定 → 主页面深位的触发器被误判"超出视口底部"→
错误翻转到 top，面板出现在触发器上方 ≈ 容器高差的位置。

### 实测证据

```
触发器 rect.bottom = 632.5（主视口系）; iframe innerHeight = 577
zag 计算结果 --y = 529 = 触发器top(595) − 面板高(58) − gutter(8)
                   ↑ 精确命中"翻转到 top"公式；若按 bottom 正常应为 632.5 + 8 = 640.5
```

### 修复建议

沙箱内默认关闭 `flip` / `shift`，退化为纯 rect 锚定（实测 `--x=60 → dialog.x=60`、
`--y=641 → gap≈9`，锚定像素级正确）。用户显式给出的 `positioning.flip/shift` 以其为准。

### 已知取舍

关闭 flip 后，靠近主视口底缘的触发器，面板可能延伸出可视区（真实翻转需要一致的坐标空间，
单靠组件层无法既锚定又正确碰撞避让；若上游要保留翻转，需把 collision boundary 换成
宿主页面的滚动容器元素——zag `positioning.boundary` 支持 Element，可由沙箱探测
`shadowRoot.host` 向上的 overflow 祖先，属增强项非本修复范围）。

---

## 完整修复 patch（已在本仓库实测验证）

> 验证环境仅有 wujie 沙箱。可选收紧：`strategy/flip/shift` 覆盖目前以
> `detectedTarget !== "body"`（含真 ShadowRoot 场景）为闸门；若上游同时支持
> 同文档真 shadow 微前端（无坐标空间错位），可把定位覆盖的闸门收紧为仅 `inWujie`。

```diff
--- a/packages/tu-design/src/components/ui/popover/Popover.vue
+++ b/Popover.vue (沙箱修复建议)
@@ -82,15 +82,22 @@
 // 故检测再延后一个微任务（mount 调用栈结束后 _container 必已赋值），结果存 ref
 // 驱动 computed 重算；getCurrentInstance 仅 setup 同步上下文可用，须顶层捕获。
 // 共享 Vue（__MICRO_SHARED__）下各子应用 app._container 相互独立，检测按实例隔离；
-// 非 shadow 环境 getRootNode() 返回 Document → 兜底 body，零破坏
+// 非 shadow 环境兜底 body，零破坏。
+// wujie 特例（实测 micro-app-demo 沙箱）：wujie 把 iframe 文档树 graft 进 shadowRoot
+// 渲染，但节点保留 iframe document 身份 —— getRootNode() 恒为 HTMLDocument（graft
+// 前后皆然），ShadowRoot 检测在 wujie 下永不命中，须叠加 __POWERED_BY_WUJIE__ 标记
+// （wujie 在子应用代码执行前注入 iframe realm，时序可靠）
 const instance = getCurrentInstance();
+const inWujie =
+  typeof window !== "undefined" &&
+  (window as { __POWERED_BY_WUJIE__?: boolean }).__POWERED_BY_WUJIE__ === true;
 const detectedTarget = ref<string | HTMLElement>("body");
 onMounted(() => {
   queueMicrotask(() => {
     if (props.to) return;
     const container = (instance?.appContext.app as { _container?: HTMLElement } | undefined)
       ?._container;
-    if (container && container.getRootNode() instanceof ShadowRoot) {
+    if (container && (container.getRootNode() instanceof ShadowRoot || inWujie)) {
       detectedTarget.value = container;
     }
   });
@@ -173,13 +180,30 @@
 onBeforeUnmount(clearTimer);

 // side/align → Ark positioning.placement（12 方位，居中不带对齐后缀）；
-// 外部经 attrs 传入的 positioning 已显式指定 placement 时以其为准，其余字段原样合并
+// 外部经 attrs 传入的 positioning 已显式指定 placement 时以其为准，其余字段原样合并。
+// 沙箱修正（实测 wujie graft 树）：① zag absolute 策略按视口空间出坐标，面板却渲染在
+// 原点=容器的 graft 树内 → 必偏移一个容器位置，fixed 以视口为包含块对齐坐标空间；
+// ② wujie 把 iframe window 的 innerHeight/Width 同步为容器尺寸，而元素 rect 是主页面
+// 视觉坐标 —— floating-ui 的翻转边界用 innerHeight 判定，深位触发器被误判"超视口"
+// 而翻到 top（实测 y 偏差 ≈ 容器高差）。沙箱内关掉 flip/shift 退化为纯 rect 锚定；
+// 用户显式给出的 positioning 字段以其为准
+const sandboxActive = computed(() => !props.to && detectedTarget.value !== "body");
 const rootPositioning = computed<ArkPositioning>(() => {
   const user = (attrs.positioning ?? {}) as ArkPositioning;
   const placement = (
     props.align === "center" ? props.side : `${props.side}-${props.align}`
   ) as ArkPlacement;
-  return { ...user, placement, sameWidth: props.matchTriggerWidth || user.sameWidth };
+  const merged: ArkPositioning = {
+    ...user,
+    placement,
+    sameWidth: props.matchTriggerWidth || user.sameWidth,
+  };
+  if (sandboxActive.value) {
+    if (user.strategy == null) merged.strategy = "fixed";
+    if (user.flip === undefined) merged.flip = false;
+    if (user.shift === undefined) merged.shift = false;
+  }
+  return merged;
 });

 // 面板样式：内置类 + contentClass + contentProps.class 三方合并（twMerge 自动去冲突，后者优先）
```

---

## 验证数据对照（micro-app-demo，同帧快照）

| 指标                            | 修复前                                  | 修复后（期望）                                  |
| ------------------------------- | --------------------------------------- | ----------------------------------------------- |
| 面板 DOM 归属                   | iframe 文档 body（graft 树内，非 #app） | `#app` 容器内（shadowRoot 内）                  |
| 主文档 body 泄漏                | 无（但也不在 shadow 容器）              | 无                                              |
| positioner position             | absolute                                | fixed                                           |
| `--y`                           | 529（误翻转公式）                       | 641 = trigger.bottom 632.5 + gutter 8.5         |
| gap（面板 top − 触发器 bottom） | −103                                    | +9 ✓                                            |
| x 对齐（bottom-center）         | 偶合正确                                | xAlign = −80 = −(288−128)/2 ✓                   |
| host 侧（非沙箱）回归           | —                                       | body 承载 ✓ / absolute ✓ / right-end 垂直对齐 ✓ |

---

## 验收用例（上游修复后可直接落地的 e2e）

### 手动（2 分钟）

```bash
pnpm dev   # 选 micro-app-demo + micro-host
```

登录 → 图标导航「测试 Demo」→ 点「打开 Popover」，DevTools console：

```js
const sr = document.querySelector("wujie-app").shadowRoot;
const t = [...sr.querySelectorAll("button")]
  .find((b) => b.textContent.includes("打开 Popover"))
  .getBoundingClientRect();
const d = sr.querySelector('#app [role="dialog"]').getBoundingClientRect();
({
  inApp: !!sr.querySelector('#app [role="dialog"]'),
  gap: Math.round(d.y - t.bottom), // 期望 ≈ 8
  strategy: getComputedStyle(sr.querySelector('#app [role="dialog"]').parentElement).position,
}); // 期望 fixed
```

### e2e 链路 9（依赖本仓库 demo 注册，修复落地后加入 `scripts/e2e.mjs`）

配套宿主仓库连带改动：

1. `startDev` 增加 `waitHttpReady("http://localhost:7204", 15_000)`（demo 端口，非 TTY 全启已包含）
2. `resetBaseline` 与 `flow1HostLoaded` 的 `nav-item` 断言 2 → 3（apps.ts 已注册 sub-demo）

```js
/**
 * 链路 9:Popover 沙箱适配(shadow 降级 + fixed 锚定)
 *
 * @returns {Promise<void>} 断言结果写入报告
 */
async function flow9PopoverSandbox() {
  console.log("[链路 9] Popover 沙箱适配");
  const opened = await clickNavItem(2);
  expect("导航项可点击(demo)", opened.clicked, true);
  await waitFn("location.pathname === '/sub-demo'", "demo Tab 激活");
  await waitAppText("打开 Popover");
  const clicked = await jsClickInActiveApp(
    "el => el.tagName === 'BUTTON' && (el.textContent || '').includes('打开 Popover')",
  );
  expect("demo Popover 触发器可点击", clicked.clicked, true);
  await waitFn(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane && pane.querySelector('wujie-app')?.shadowRoot;" +
      " return !!sr && !!sr.querySelector('#app [role=\"dialog\"]'); })()",
    "Popover 面板落入子应用 #app 容器",
  );
  const geom = await evalJson(
    "(() => { const pane = [...document.querySelectorAll('.tab-pane')].find(x => x.style.display !== 'none');" +
      " const sr = pane.querySelector('wujie-app').shadowRoot;" +
      " const dlg = sr.querySelector('#app [role=\"dialog\"]');" +
      " const t = [...sr.querySelectorAll('button')].find(b => (b.textContent || '').includes('打开 Popover')).getBoundingClientRect();" +
      " const d = dlg.getBoundingClientRect();" +
      " const bodyLeak = [...document.body.querySelectorAll('[role=\"dialog\"]')].some(x => (x.textContent || '').includes('气泡内容'));" +
      " return { gap: Math.round(d.y - t.bottom), xCenterOff: Math.round(d.x - t.x + (d.width - t.width) / 2)," +
      " strategy: getComputedStyle(dlg.parentElement).position, bodyLeak }; })()",
  );
  expect("面板不落入主文档 body", geom.bodyLeak, false);
  expect("沙箱内定位策略 fixed", geom.strategy, "fixed");
  expect("锚定 gap ≈ 8(gutter)", Math.abs(geom.gap - 8) <= 12, true);
  expect("x 居中对齐(偏差 ≤ 4px)", Math.abs(geom.xCenterOff) <= 4, true);
  // host 回归:avatar 用户菜单保持 body 承载 + absolute
  const av = await evalJson(
    "(() => { const b = document.querySelector('.nav-avatar'); if (!b) return { found: false }; b.click(); return { found: true }; })()",
  );
  expect("host avatar 可点击", av.found, true);
  await waitFn(
    "(() => { const dlg = [...document.querySelectorAll('body [role=\"dialog\"]')].find(x => (x.textContent || '').includes('退出登录')); return !!dlg && document.body.contains(dlg.parentElement); })()",
    "host 用户菜单打开(body 承载)",
  );
  const host = await evalJson(
    "(() => { const dlg = [...document.querySelectorAll('body [role=\"dialog\"]')].find(x => (x.textContent || '').includes('退出登录'));" +
      " return { strategy: getComputedStyle(dlg.parentElement).position }; })()",
  );
  expect("host 定位策略保持 absolute", host.strategy, "absolute");
  await evalJson(
    "(() => { document.querySelector('.nav-avatar').click(); return { closed: true }; })()",
  );
}
```

`main()` 中 `flow8LayoutSwitch()` 之后追加 `await flow9PopoverSandbox();`，成功文案
「8 条链路全部通过」→「9 条链路全部通过」。

---

## 附：本仓库当前状态（供 tu-design 侧对照，2026-11-06 更新）

- `@tu-design/vue` 已升级至 catalog `^0.5.8`（`pnpm-workspace.yaml`，`components.lock.json`
  同步为 0.5.8，hash 记账一致）；本仓库仍未携带上述修复 patch，vendor
  `Popover.vue` 保持上游原样（文件内无 `inWujie`/`sandboxActive` 等本地标记）
- 本报告建议的 e2e 连带改动已被现有实现覆盖：`waitHttpReady("http://localhost:7204")`
  已在 `scripts/e2e.mjs` 启动流程落地；`nav-item` 断言改为 `registeredTabAppCount()`
  动态计数（注册表增减免维护）；链路 9 未加入，e2e 仍为 8 条链路
- 端口以各 app `vite.config.ts` 为准：micro-host 5175 / micro-auth 7203 /
  micro-app-demo 7204（早期 7201/7202 已随应用改名废弃）；`node scripts/stop.mjs` 可停
