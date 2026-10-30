# 应用间通信

无界提供三种通信方式，可组合使用。路由联动场景详见 [routing.md](routing.md)。

---

## 方式对比

| 方式       | 方向    | 特点                     | 典型场景               |
| ---------- | ------- | ------------------------ | ---------------------- |
| **props**  | 主 → 子 | 声明式注入，子应用只读   | 传配置、注入 jump 方法 |
| **bus**    | 双向    | 去中心化事件，保活仍有效 | 子应用间跳转、菜单联动 |
| **window** | 双向    | 同源直接访问             | 简单调用、读全局状态   |

---

## props 通信

**主应用**：

```vue
<WujieVue name="vue3" url="..." :props="{ data: userInfo, jump: jumpToApp }" />
```

```javascript
methods: {
  jumpToApp(location) {
    this.$router.push(location);
  },
}
```

**子应用**：

```javascript
const props = window.$wujie?.props;
props.jump({ name: "react17" });
props.data;
```

props 在 `startApp` / `setupApp` 时传入，更新 props 需重新 `startApp` 或保活 `active` 时传入新 props。

---

## bus 通信

主应用与子应用共享同一 EventBus 实例。

**主应用**：

```javascript
import WujieVue from "wujie-vue3";
const { bus } = WujieVue;

bus.$on("from-child", (data) => console.log(data));
bus.$emit("to-child", payload);
```

**子应用**：

```javascript
window.$wujie?.bus.$emit("from-child", { foo: 1 });
window.$wujie?.bus.$on("to-child", (data) => {
  /* ... */
});
```

**Vue 组件快捷方式**：子应用 `$emit` 的事件可直接 `@eventName` 监听。

### 保活模式下的 bus

- 子应用切走后**监听仍有效**，可继续 `$emit` / `$on`
- 非保活子应用销毁时框架自动 `$clear` 订阅
- 在页面级 `mounted` 反复 `$on` 不 `$off` 会重复订阅

### 保活 + 刷新后 bus 异常

Issue #585：浏览器刷新后 bus 可能报异常，可改用 `window.parent` 直接通信作为兜底。

---

## window 通信

子应用 iframe 与主应用**同域**（wujie 默认将 iframe src 设为主应用 host）。

**主应用调子应用**：

```javascript
const childWindow = document.querySelector('iframe[name="子应用name"]')?.contentWindow;
childWindow.someGlobalFn();
```

**子应用调主应用**：

```javascript
window.parent.someGlobalFn();
window.parent.document; // 可访问主应用 DOM（谨慎使用）
```

---

## 路由相关通信模式（速查）

### 子应用通知主应用换菜单（子 → 主）

```javascript
// 子应用
window.$wujie?.bus.$emit("sub-route-change", "vue3", "/home");

// 主应用 main.js
bus.$on("sub-route-change", (name, path) => {
  router.push({ path: `/${name}-sub${path}` });
});
```

### 主应用通知保活子应用换路由（主 → 子）

```javascript
// 主应用
bus.$emit("vue3-router-change", "/dialog");

// 子应用 App.vue mounted
window.$wujie?.bus.$on("vue3-router-change", (path) => router.push(path));
```

### 子应用间跳转

```javascript
window.$wujie?.props.jump({ name: "react17" });
// 保活已实例化时指定路由用 bus，见 routing.md
```

---

## 选型建议

```
需要传初始配置 / 方法注入     → props
需要双向事件 / 多应用广播     → bus
需要读对方全局变量 / 简单调用  → window.parent
路由菜单联动                 → bus（见 routing.md 完整链路）
```

---

## 注意

1. 不要在 props 中传超大对象（每次 active 会传递）
2. bus 事件名建议加应用前缀避免冲突：`vue3-route-change`
3. 组件销毁时 `$off` 或依赖框架自动清理（非保活）
