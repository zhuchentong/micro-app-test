# 主应用 API 与子应用 $wujie

## 导入

```javascript
import {
  bus,
  setupApp,
  preloadApp,
  startApp,
  destroyApp,
  refreshApp,
  clearAssetsCache,
} from "wujie";
```

框架封装包（`wujie-vue2` / `wujie-vue3` / `wujie-react`）通过静态属性暴露相同 API。

---

## setupApp

预置子应用默认配置，避免 `preloadApp` / `startApp` 重复传参。

```typescript
setupApp({
  name: string;        // 唯一 ID，必填
  url?: string;
  exec?: boolean;      // 预加载时是否预执行（见 preloadApp）
  el?: HTMLElement | string;
  sync?: boolean;
  prefix?: Record<string, string>;
  alive?: boolean;
  props?: Record<string, any>;
  fetch?: typeof fetch;
  fiber?: boolean;
  degrade?: boolean;
  attrs?: Record<string, any>;
  degradeAttrs?: Record<string, any>;
  plugins?: plugin[];
  // 生命周期钩子同 startApp
  replace?: (code: string) => string;
  iframeAddEventListeners?: string[];
  iframeOnEvents?: string[];
});
```

**行为**：按 `name` 缓存配置；后续 `startApp({ name })` 会与缓存 merge，显式传入的字段覆盖缓存。

---

## startApp

启动并渲染子应用。返回 `Promise<Function | void>`，resolve 的函数用于销毁当前实例。

```typescript
startApp({
  name: string;              // 唯一 ID
  url: string;               // 子应用地址
  el: HTMLElement | string;  // 渲染容器
  html?: string;             // 直接提供 HTML，跳过请求 url
  loading?: HTMLElement;
  sync?: boolean;            // 路由同步到主应用 URL query
  prefix?: Record<string, string>;  // 短路径，sync 时生效
  alive?: boolean;           // 保活模式
  props?: Record<string, any>;
  fiber?: boolean;           // requestIdleCallback 分片执行 JS
  degrade?: boolean;         // 降级为原生 iframe 渲染
  attrs?: Record<string, any>;       // 子应用 iframe 属性
  degradeAttrs?: Record<string, any>;
  fetch?: typeof fetch;
  replace?: (code: string) => string;
  plugins?: plugin[];
  iframeAddEventListeners?: string[];
  iframeOnEvents?: string[];
  // 生命周期
  beforeLoad?: (appWindow: Window) => any;
  beforeMount?: (appWindow: Window) => any;
  afterMount?: (appWindow: Window) => any;
  beforeUnmount?: (appWindow: Window) => any;
  afterUnmount?: (appWindow: Window) => any;
  activated?: (appWindow: Window) => any;    // 保活激活
  deactivated?: (appWindow: Window) => any; // 保活切走
  loadError?: (url: string, e: Error) => any;
});
```

### 关键行为（源码验证）

| 场景                                | 行为                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| 同名实例已存在 + `alive: true`      | 复用 iframe，调用 `activated`，**改 url 不改变子应用路由** |
| 同名实例已存在 + 有 `__WUJIE_MOUNT` | 先 unmount 再 mount（单例模式）                            |
| 同名实例已存在 + 无 mount 函数      | destroy 后重建                                             |
| `sync: false`                       | 子应用跳转不改主应用 URL，但主应用 history 仍会增加        |
| 初次实例化 + sync                   | 从主应用 URL query 读回子应用路由；**之后只单向同步**      |

---

## preloadApp

空闲时预加载子应用资源，加快首次打开速度。

```typescript
preloadApp({
  name: string;
  url?: string;
  exec?: boolean;  // true = 预执行 JS（类似 SSR 体验）
  // 其余参数同 setupApp
});
```

**注意**：

- 已有同名实例或 URL 中带 sync query（刷新/分享链接场景）时跳过预加载
- `exec: true` 需配合 `setupApp` 使用，子应用 JS 会提前执行
- 多个子应用时不要全部预加载，按需加载（见 modes.md）

---

## destroyApp / refreshApp / clearAssetsCache

```javascript
await destroyApp("子应用name");  // 销毁实例

await refreshApp({ name, url, el, ... });  // 先 destroy 再 startApp

clearAssetsCache();  // 清除子应用 HTML/JS/CSS 缓存（发版后资源 404 时用）
```

`refreshApp` 等价于重建模式的全量刷新。Vue/React 组件另有实例方法 `refresh()`，复用当前 props 重建。

---

## bus（EventBus）

去中心化事件总线，主应用与子应用共享同一实例。

```javascript
bus.$on(event, fn);
bus.$once(event, fn);
bus.$onAll(fn); // fn(event, ...args)
bus.$emit(event, ...args);
bus.$off(event, fn);
bus.$offAll(fn);
bus.$clear();
```

**注意**：

- 非保活子应用销毁时框架自动 `$clear` 该子应用订阅
- 保活子应用切走后**仍可响应** bus 事件
- 避免在 `mounted` 反复 `$on` 不 `$off`，应在 `unmount` 时取消订阅

子应用：`window.$wujie?.bus.$emit(...)` / `$on(...)`

组件封装支持 `@event` 直接监听子应用 `$emit` 的事件。

---

## 子应用 $wujie

子应用内通过 `window.$wujie` 或 `window.$wujie` 访问：

```typescript
{
  bus: EventBus;
  shadowRoot?: ShadowRoot;   // 子应用渲染容器
  props?: Record<string, any>;  // 主应用注入
  location?: Location;       // 子应用真实 location
}
```

### $wujie.location 勘误

| 子应用类型              | window.location     | 说明                     |
| ----------------------- | ------------------- | ------------------------ |
| Webpack 等非 ESM        | 被 proxy 代理       | 一般无需改代码           |
| **Vite（type=module）** | **拿到主应用 host** | 必须用 `$wujie.location` |
| 降级 degrade 模式       | proxy 失效          | 必须用 `$wujie.location` |

修改 `$wujie.location.href` 会删除 shadow 并替换为 iframe（特殊跳转行为）。

### 环境变量

| 变量                          | 含义                          |
| ----------------------------- | ----------------------------- |
| `window.__POWERED_BY_WUJIE__` | 是否在无界环境运行            |
| `window.__WUJIE_MOUNT`        | 单例模式挂载函数              |
| `window.__WUJIE_UNMOUNT`      | 单例模式卸载函数              |
| `window.__WUJIE.mount()`      | Vite 异步加载时主动触发 mount |
| `window.__WUJIE_RAW_WINDOW__` | 子应用真实 window（非代理）   |
