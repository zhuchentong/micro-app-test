# 子应用改造

无界对子应用侵入极小。**满足跨域时，保活/重建模式通常零改造。**

---

## 接入前提：CORS

子应用静态资源和 API 从主应用页面域名发起请求，必须配置跨域：

```javascript
// Node.js 示例
res.set({
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Origin": req.headers.origin || "*",
  "Access-Control-Allow-Headers": "X-Requested-With,Content-Type",
  "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
});
```

需要 cookie 时，主应用自定义 `fetch` 设 `credentials: 'include'`，且 `Allow-Origin` 不能为 `*`。

---

## 零改造条件

- 子应用服务端 CORS 正确
- 使用**保活**或**重建**模式（默认）
- 非 Vite 或 Vite 已处理 `$wujie.location`
- 非单例模式（或已做生命周期改造）

---

## 环境检测

```javascript
if (window.__POWERED_BY_WUJIE__) {
  // 在无界环境运行
}
```

---

## 生命周期改造（单例模式）

`alive: false` 且多页面共享同一 `name` 时需改造，将挂载/卸载挂到无界钩子：

### Vue 2

```javascript
if (window.__POWERED_BY_WUJIE__) {
  let instance;
  window.__WUJIE_MOUNT = () => {
    instance = new Vue({ router: new VueRouter({ routes }), render: (h) => h(App) }).$mount("#app");
  };
  window.__WUJIE_UNMOUNT = () => {
    instance.$destroy();
  };
} else {
  new Vue({ router: new VueRouter({ routes }), render: (h) => h(App) }).$mount("#app");
}
```

### Vue 3

```javascript
if (window.__POWERED_BY_WUJIE__) {
  let instance;
  window.__WUJIE_MOUNT = () => {
    const router = createRouter({ history: createWebHistory(), routes });
    instance = createApp(App);
    instance.use(router);
    instance.mount("#app");
  };
  window.__WUJIE_UNMOUNT = () => {
    instance.unmount();
  };
} else {
  createApp(App).use(router).mount("#app");
}
```

### Vite + Vue 3（必须主动 mount）

```javascript
if (window.__POWERED_BY_WUJIE__) {
  let instance;
  window.__WUJIE_MOUNT = () => {
    const router = createRouter({ history: createWebHistory(), routes });
    instance = createApp(App);
    instance.use(router);
    instance.mount("#app");
  };
  window.__WUJIE_UNMOUNT = () => {
    instance.unmount();
  };
  window.__WUJIE.mount(); // Vite 异步加载，防止 mount 未执行
} else {
  createApp(App).use(router).mount("#app");
}
```

### React

```javascript
if (window.__POWERED_BY_WUJIE__) {
  window.__WUJIE_MOUNT = () => {
    ReactDOM.render(<App />, document.getElementById("root"));
  };
  window.__WUJIE_UNMOUNT = () => {
    ReactDOM.unmountComponentAtNode(document.getElementById("root"));
  };
} else {
  ReactDOM.render(<App />, document.getElementById("root"));
}
```

### Angular

```typescript
if (window.__POWERED_BY_WUJIE__) {
  let instance;
  window.__WUJIE_MOUNT = async () => {
    instance = await platformBrowserDynamic().bootstrapModule(AppModule);
  };
  window.__WUJIE_UNMOUNT = () => {
    instance.destroy?.();
  };
}
```

---

## Vite 特殊处理

**所有 `window.location` 操作改为 `$wujie.location`**（host、href、search 等）。

```javascript
// 错误
const host = window.location.host;

// 正确
const host = window.$wujie?.location.host;
```

Webpack 子应用通常无需修改（location 被 proxy）。

---

## 子应用内通信

```javascript
// 读主应用注入
const { jump, data } = window.$wujie?.props || {};

// 事件总线
window.$wujie?.bus.$emit("event", payload);
window.$wujie?.bus.$on("event", handler);

// 调主应用
window.parent.someMethod();
```

路由联动见 [routing.md](routing.md)。

---

## 其他改造场景

### Module Federation

```javascript
// ModuleFederationPlugin
library: { type: "window", name: "与name一致" }
```

### 动态 style / v-html 图片路径

入口最上方：

```javascript
if (window.__POWERED_BY_WUJIE__) {
  window.__webpack_public_path__ = window.__WUJIE_PUBLIC_PATH__;
}
```

### 地图类库（百度地图等）

独立运行正常、无界内图层异常时，检查 API key 域名白名单是否包含主应用域名。

### 非 Webpack 老项目

可零改造，但切换可能白屏，建议用保活模式。

---

## 官方示例子应用

| 技术栈     | 路径                 |
| ---------- | -------------------- |
| Vue 2      | `examples/vue2`      |
| Vue 3      | `examples/vue3`      |
| Vite       | `examples/vite`      |
| React 16   | `examples/react16`   |
| React 17   | `examples/react17`   |
| Angular 12 | `examples/angular12` |

主应用 demo：`examples/main-vue`、`examples/main-react`
