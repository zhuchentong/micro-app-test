# 路由跳转专题

主应用左侧菜单切换子应用页面，是无界接入中最容易踩坑的部分。官方 demo（`examples/main-vue`）采用**双层路由 + bus 通信**模式。

---

## 1. 主应用路由架构（推荐）

为每个子应用设计两层路由：

| 路由               | 用途                                     | 示例             |
| ------------------ | ---------------------------------------- | ---------------- |
| `/{app}`           | 子应用首页，WujieVue 加载默认 url        | `/vue3`          |
| `/{app}-sub/:path` | 子应用内具体页面，动态拼 url 或 bus 通知 | `/vue3-sub/home` |

```javascript
// router/index.js（摘自 main-vue）
const routes = [
  { path: "/vue3", name: "vue3", component: () => import("../views/Vue3.vue") },
  { path: "/vue3-sub/:path", name: "vue3-sub", component: () => import("../views/Vue3-sub.vue") },
];
```

```vue
<!-- App.vue 菜单 -->
<router-link to="/vue3">vue3 首页</router-link>
<router-link to="/vue3-sub/home">vue3 home</router-link>
<router-link to="/vue3-sub/dialog">vue3 dialog</router-link>
```

---

## 2. 三种路由模式选型

| 模式               | 配置                  | 适用场景                     | 主→子路由          | 子→主菜单              |
| ------------------ | --------------------- | ---------------------------- | ------------------ | ---------------------- |
| **sync 自动同步**  | `:sync="true"`        | 单页面嵌入、不需菜单联动     | URL query 自动同步 | 需额外 bus             |
| **双层路由 + bus** | 保活 + `xxx-sub` 路由 | **官方 demo 推荐**，菜单高亮 | bus `$emit`        | bus `sub-route-change` |
| **props.jump**     | 注入 jump 方法        | 子应用间跳转                 | `props.jump`       | —                      |

### sync 模式（简单场景）

```vue
<WujieVue name="vue3" :url="hostMap('//localhost:7300/')" :sync="true" />
```

- 子应用路由编码到主应用 URL query（key 为 `name`）
- 刷新/分享链接可恢复子应用路由
- **仅初次实例化从 URL 读回路由**，之后单向同步
- 不适合需要主应用菜单联动的复杂场景

### 保活 + 双层路由（复杂场景，官方 demo）

**关键约束：保活模式下改 `url` 不会改变子应用路由**（源码 `alive` 分支不根据新 url 跳转）。

---

## 3. 子应用 → 主应用（菜单联动）

子应用路由变化时通知主应用，使左侧菜单高亮对应项。

**子应用**（`examples/vue3/src/App.vue`）：

```javascript
watch: {
  $route() {
    window.$wujie?.bus.$emit("sub-route-change", "vue3", this.$route.path);
  },
},
```

**主应用**（`examples/main-vue/src/main.js`）：

```javascript
import WujieVue from "wujie-vue2";
const { bus } = WujieVue;

bus.$on("sub-route-change", (name, path) => {
  const mainName = `${name}-sub`;
  const mainPath = `/${name}-sub${path}`;
  const { name: curName, path: curPath } = router.currentRoute;
  if (mainName === curName && mainPath !== curPath) {
    router.push({ path: mainPath });
  }
});
```

---

## 4. 主应用 → 子应用（保活模式）

保活子应用复用同一实例，主应用路由变化时需 bus 通知子应用内部 `$router.push`。

**主应用子路由页**（`Vue3-sub.vue`）：

```vue
<template>
  <WujieVue name="vue3" :url="vue3Url" />
</template>

<script>
import wujieVue from "wujie-vue2";
export default {
  data() {
    return {
      vue3Url: hostMap("//localhost:7300/") + this.$route.params.path,
    };
  },
  watch: {
    "$route.params.path": {
      handler() {
        wujieVue.bus.$emit("vue3-router-change", `/${this.$route.params.path}`);
      },
      immediate: true,
    },
  },
};
</script>
```

**子应用**（`vue3/src/App.vue`）：

```javascript
mounted() {
  window.$wujie?.bus.$on("vue3-router-change", (path) => this.$router.push(path));
},
```

> 保活首页（`/vue3`）用 sync 或默认 url；子页面（`/vue3-sub/*`）用上述 bus 模式。

---

## 5. 子应用间跳转

主应用注入 `jump`，子应用调用 `$wujie.props.jump`。

**主应用**：

```javascript
// setupApp 或组件 props
const props = {
  jump: (name) => router.push({ name }), // 按路由 name 跳
  // 或
  jump: (location) => router.push(location),
};
```

**子应用 A 跳到子应用 B**：

```javascript
window.$wujie?.props.jump({ path: "/react17" });
// 或 jump({ name: "react17" })
```

### 跳到 B 的指定子路由

1. B 开启 `sync: true`
2. 未激活过 B 时：

```javascript
window.$wujie?.props.jump({ path: "/pathB", query: { B: "/test" } });
// query 的 key 为 B 应用的 name
```

3. B 已保活且已实例化：用 bus

```javascript
// A 发
window.$wujie?.bus.$emit("routeChange", "/test");
// B 监听
window.$wujie?.bus.$on("routeChange", (path) => router.push({ path }));
```

---

## 6. hash 主应用

hash 模式下 query 挂在 hash 后面，无界 sync 读的是 URL search。需改造 `jump`：

```javascript
jump(location, query) {
  this.$router.push(location);
  const url = new URL(window.location.href);
  url.search = query;
  window.history.replaceState(null, "", url.href);
},
```

子应用调用：`props.jump({ path: "/pathB" }, "?B=" + encodeURIComponent("/test"))`

---

## 7. prefix 短路径

`sync` 时子应用 url 过长可用 `prefix` 缩短同步到主应用的 query：

```javascript
setupApp({
  name: "react16",
  prefix: { "prefix-dialog": "/dialog", "prefix-location": "/location" },
});
```

匹配最长前缀原则：`/dialog/foo` → `{prefix-dialog}/foo`

---

## 8. 多标签页架构

**问题**（Issue #391、#516）：主应用多 Tab 若组件 `name` 相同，切换 Tab 后子应用无法正常挂载/激活。

**原则**：

- **每个 Tab 对应唯一 `name`**，或每 Tab 独立 WujieVue 实例
- 保活 + 多 Tab：一 Tab 一实例，切 Tab 用 `activated`/`deactivated`
- 不要多个 Tab 共享同一 `name` 的保活实例

常见方案：

1. `name` 加 Tab ID：`name="vue3-tab-${tabId}"`
2. 非保活 + 单例模式：Tab 切换销毁重建
3. 主应用 `keep-alive` 包裹 WujieVue 组件 + 子应用 bus 路由同步

---

## 9. Deep Link（直接打开子路由）

**现象**（Issue #1075）：直接访问带子应用路由的 URL，子应用页面加载不到。

**原因**：sync 仅在**初次实例化**从 URL 读回路由；保活已实例化后不会重新读。

**解决**：

- 确保 `sync: true` 且 URL query 含正确编码的子应用路径
- 保活场景用双层路由：`/vue3-sub/home` 对应组件 watch 路由并 bus 通知子应用
- 主应用路由在 WujieVue mount **之前**就位，避免容器未就绪

---

## 10. 常见误区

| 误区                                     | 正确做法                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| 保活模式改 `url` prop 跳子路由           | bus 通信（`xxx-router-change`）                          |
| sync + `sub-route-change` 同时做同一件事 | 二选一，否则组件/请求执行两次（#328）                    |
| 多个页面共用 `name` 但 url 不同          | 单例模式可以；保活/multi-Tab 会冲突                      |
| 刷新后后退按钮无反应                     | 检查 sync 是否正确编码；避免重复 push（#308）            |
| sync 刷新 URL 参数叠加                   | 检查是否在已有 query 上重复 encode（#1045）              |
| 依赖 `history.state` 传参                | 无界 sync 不支持 history.state（#1043），用 query 或 bus |

路由同步配置细节见 [modes.md](modes.md)，通信机制见 [communication.md](communication.md)。
