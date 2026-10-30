# 插件与生命周期

## 生命周期钩子

```typescript
type lifecycle = (appWindow: Window) => any;

beforeLoad; // 加载资源前（iframe window 已存在）
beforeMount; // 单例：mount 前（需 __WUJIE_MOUNT）
afterMount; // 单例：mount 后
beforeUnmount; // 单例：unmount 前
afterUnmount; // 单例：unmount 后
activated; // 保活：切回激活
deactivated; // 保活：切走
loadError; // 资源加载失败 (url, error)
```

### 各模式下的触发

| 钩子                         | 重建   | 保活              | 单例     |
| ---------------------------- | ------ | ----------------- | -------- |
| beforeLoad                   | 每次   | 首次 + 未 exec 时 | 每次     |
| beforeMount / afterMount     | —      | —                 | 每次切换 |
| activated / deactivated      | —      | 切回/切走         | —        |
| beforeUnmount / afterUnmount | 销毁时 | —                 | 每次切换 |

```javascript
setupApp({
  name: "app",
  beforeLoad: (win) => console.log("loading", win),
  afterMount: (win) => console.log("mounted", win),
  loadError: (url, e) => console.error(url, e),
});
```

---

## 插件体系

运行时修改子应用资源，无需改子应用仓库。

```javascript
const plugins = [
  {
    htmlLoader: (code) => code,
    jsExcludes: [/analytics\.js/],
    jsIgnores: [/cdn\.example\.com/],
    jsBeforeLoaders: [{ src: "..." }, { content: "..." }, { callback(appWindow) {} }],
    jsLoader: (code, url, base) => code,
    jsAfterLoaders: [{ callback(appWindow) {} }],
    cssExcludes: [],
    cssIgnores: [],
    cssBeforeLoaders: [],
    cssLoader: (code, url, base) => code,
    cssAfterLoaders: [],
    windowAddEventListenerHook: (iframeWindow, type, handler, options) => {},
    windowRemoveEventListenerHook: (iframeWindow, type, handler, options) => {},
    documentAddEventListenerHook: (iframeWindow, type, handler, options) => {},
    documentRemoveEventListenerHook: (iframeWindow, type, handler, options) => {},
    appendOrInsertElementHook: (element, iframeWindow) => {},
    patchElementHook: (element, iframeWindow) => {},
    windowPropertyOverride: (iframeWindow) => {},
    documentPropertyOverride: (iframeWindow) => {},
  },
];
```

### 常用插件场景

| 插件                     | 场景                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `jsLoader`               | 将 `var xxx` 替换为 `window.xxx`（第三方全局变量）                         |
| `jsExcludes`             | 排除不执行的脚本                                                           |
| `jsIgnores`              | 让子应用自行加载（避免跨域劫持）；**注意 location 必须用 $wujie.location** |
| `htmlLoader`             | 修改子应用 HTML                                                            |
| `cssExcludes`            | 排除样式                                                                   |
| `patchElementHook`       | 修改插入的 DOM 元素                                                        |
| `windowPropertyOverride` | 覆盖子应用 window 属性                                                     |

### jsLoader 示例：全局变量挂载

```javascript
{
  jsLoader: (code, url) => {
    if (url.includes("problem-lib.js")) {
      return code.replace(/var\s+(\w+)\s*=/g, "window.$1 =");
    }
    return code;
  },
}
```

---

## iframe attrs 空页

**问题**（Issue #54）：iframe src 为主应用 host，加载主应用 HTML/JS。

**解决**：

```javascript
setupApp({
  name: "app",
  attrs: { src: "https://your-domain.com/empty" },
});
```

`/empty` 返回空 HTML、不 302 跳转。

主应用 template 亦可插入（兜底）：

```html
<script>
  if (window.parent !== window) {
    window.stop();
  }
</script>
```

---

## 子应用真实 window

子应用 `window` 是代理对象。需要原生 window 时：

```javascript
const rawWindow = window.__WUJIE_RAW_WINDOW__;
```

用于需要绕过代理的特殊场景（谨慎使用）。

---

## Element Plus popper 容器

子应用销毁后 `el-popper-container-*` 被移除，再次启动时 popper 根元素可能未重建（Issue #682 相关）。

**缓解**：

- 保活模式减少销毁
- `deactivated` 时清理、`activated` 时重建 popper
- 升级 Element Plus 到已修复版本

---

## 样式与 DOM 钩子

子应用动态 `v-html` / `innerHTML` 插入的 style，默认插件无法处理相对路径图片：

```javascript
// 子应用入口
if (window.__POWERED_BY_WUJIE__) {
  window.__webpack_public_path__ = window.__WUJIE_PUBLIC_PATH__;
}
```

`patchElementHook` 可将样式挂到主应用 head（慎用，破坏隔离）。

---

## loadError 与监控

```javascript
loadError: (url, error) => {
  // 上报 + 降级处理
  console.error(`[wujie] failed to load: ${url}`, error);
},
```

配合 [deployment.md](deployment.md) 自定义 fetch 超时。
