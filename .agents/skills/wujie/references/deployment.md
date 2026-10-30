# 部署与运维

## 部署架构

### 同域部署（推荐）

主应用 `https://host/app/`，子应用 `https://host/child/`

- 无跨域问题（若资源同源）
- localStorage 共享
- 仍需子应用静态资源 CORS 若从不同端口开发

### 跨域部署（常见开发态）

主应用 `localhost:8000`，子应用 `localhost:7300`

- 子应用必须 CORS
- cookie 需 `fetch credentials: 'include'`
- 生产建议统一域名 + 网关转发

---

## Nginx 配置要点

### 不缓存 index.html

子应用发版后文件名 hash 变化，缓存旧 HTML 会引用不存在资源：

```nginx
location / {
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location ~* \.(js|css|png|jpg|gif|ico|woff2?)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

Issue #1028

### 开发代理

```nginx
location /child/ {
  proxy_pass http://localhost:7300/;
  add_header Access-Control-Allow-Origin $http_origin;
  add_header Access-Control-Allow-Credentials true;
}
```

---

## 子应用发版后 404

**现象**：子应用重新部署，wujie 加载旧 hash 资源 404。

**处理**：

```javascript
import { clearAssetsCache } from "wujie";
// 发版后首次访问或检测到 404 时
clearAssetsCache();
```

配合 nginx 不缓存 `index.html`，让 wujie 拉取最新资源列表。

---

## 生产 base 路径

主应用有 `base`（如 `/demo-main-vue/`）时：

```javascript
const router = new VueRouter({
  mode: "history",
  base: process.env.NODE_ENV === "production" ? "/demo-main-vue/" : "",
  routes,
});
```

子应用 `url` 用完整地址。无痕模式 loading 异常检查 base 是否正确（Issue #1044）。

---

## 自定义 fetch

### 携带 cookie（跨域登录）

```javascript
function credentialsFetch(url, options) {
  return window.fetch(url, {
    ...options,
    credentials: "include",
  });
}

setupApp({ name: "app", fetch: credentialsFetch });
```

### 带超时的 fetch（防白屏）

```javascript
function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return window
    .fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}
```

Issue #1057：单个子应用脚本超时阻塞整个 execQueue，必须用超时 fetch。

### 按域名区分 fetch

```javascript
fetch: (url, options) =>
  url.includes(childHost) ? credentialsFetch(url, options) : window.fetch(url, options),
```

---

## iframe attrs 空页（生产必配）

防止 iframe src 为主应用 host 时加载主应用资源或 302 破坏沙箱：

```javascript
setupApp({
  name: "app",
  attrs: { src: "https://your-host/empty" }, // 返回空内容、不跳转的页面
});
```

主应用提供 `/empty` 路由返回空 HTML。见 [plugin-lifecycle.md](plugin-lifecycle.md)。

---

## 监控建议

- 监听 `loadError` 生命周期，上报资源加载失败
- 子应用 `afterMount` 打点首屏时间
- 发版流水线后通知主应用 `clearAssetsCache`（或版本号变更时自动清理）
