# 主应用框架封装

## Vue 2

```bash
npm i wujie-vue2
```

```javascript
import WujieVue from "wujie-vue2";
const { bus, setupApp, preloadApp, destroyApp, refreshApp } = WujieVue;

Vue.use(WujieVue);
```

```vue
<WujieVue
  width="100%"
  height="100%"
  name="vue3"
  :url="url"
  :sync="true"
  :alive="true"
  :props="props"
  :fetch="fetch"
  @click="onSubAppEvent"
/>
```

子应用 `bus.$emit('click', data)` 可直接 `@click` 监听。

## Vue 3

```bash
npm i wujie-vue3
```

```javascript
import WujieVue from "wujie-vue3";
const { bus, setupApp, preloadApp, destroyApp, refreshApp } = WujieVue;

app.use(WujieVue);
```

组件 Props 与 Vue2 相同。`beforeDestroy` 改为 `beforeUnmount`（组件内部已处理）。

## React

```bash
npm i wujie-react
```

```javascript
import WujieReact from "wujie-react";
const { bus, setupApp, preloadApp, destroyApp, refreshApp } = WujieReact;
```

```jsx
<WujieReact
  width="100%"
  height="100%"
  name="react17"
  url="//localhost:7100/"
  sync={true}
  alive={true}
  props={props}
  fetch={credentialsFetch}
/>
```

> TypeScript 类型不完整时可自行扩展 Props（Issue #1032）。

## 组件 Props 一览

与 `startApp` 参数一一对应：

| Prop                     | 类型                       | 说明            |
| ------------------------ | -------------------------- | --------------- |
| name                     | string                     | 唯一 ID         |
| url                      | string                     | 子应用地址      |
| width / height / style   | string / object            | 容器尺寸        |
| sync                     | boolean                    | 路由同步        |
| prefix                   | object                     | 短路径          |
| alive                    | boolean                    | 保活            |
| props                    | object                     | 注入子应用      |
| fetch                    | function                   | 自定义 fetch    |
| attrs                    | object                     | iframe 属性     |
| fiber                    | boolean                    | 分片执行        |
| degrade                  | boolean                    | 降级 iframe     |
| plugins                  | array                      | 插件            |
| loading                  | HTMLElement / ReactElement | 加载态          |
| beforeLoad ~ deactivated | function                   | 生命周期        |
| loadError                | function                   | 资源加载失败    |
| replace                  | function                   | 代码替换        |
| iframeAddEventListeners  | string[]                   | iframe 监听事件 |
| iframeOnEvents           | string[]                   | iframe on 事件  |

## 组件实例方法

```javascript
// Vue: this.$refs.wujieRef.refresh()
// 或通过 wujieVue 组件 ref 调用 refresh()
```

`refresh()`：销毁当前实例并按当前 props 全量重建，返回 Promise。

## 推荐初始化模式（摘自 main-vue）

```javascript
import WujieVue from "wujie-vue2";
const { setupApp, preloadApp, bus } = WujieVue;

// 1. 全局 bus 监听
bus.$on("sub-route-change", (name, path) => {
  /* 见 routing.md */
});

// 2. 预置每个子应用配置
setupApp({
  name: "vue3",
  url: hostMap("//localhost:7300/"),
  exec: true, // 预加载时预执行
  alive: true,
  props: { jump: (name) => router.push({ name }) },
  fetch: credentialsFetch,
  degrade: !window.Proxy,
});

// 3. 空闲预加载
preloadApp({ name: "vue3" });
```

## 无框架直调

```javascript
import { startApp, setupApp } from "wujie";

setupApp({ name: "app1", url: "//child.com/" });

startApp({
  name: "app1",
  el: document.getElementById("container"),
});
```

## 注意点

1. 组件 `mounted` 时自动 `startApp`；`name` 或 `url` 变化会重新执行（串行队列 `__WUJIE_QUEUE`）
2. 保活时 `url` 变化**不会**跳转子应用路由（见 routing.md）
3. 生产环境 GitHub Pages 等 CSP 场景，可设 `attrs: { src: hostMap('//localhost:8000/') }` 修正 iframe src
