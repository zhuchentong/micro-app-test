# 运行模式与性能

## 三种运行模式

| 模式     | 条件                             | 切换页面时                     | 改 url                           |
| -------- | -------------------------------- | ------------------------------ | -------------------------------- |
| **重建** | 默认                             | 销毁 webcomponent + iframe     | 跳转路由（sync 时 URL 参数优先） |
| **保活** | `alive: true`                    | 保留 iframe 和状态，dom 可卸载 | **不跳转**，需 bus               |
| **单例** | `alive: false` + `__WUJIE_MOUNT` | unmount → mount 新实例         | 跳转路由                         |

### 保活模式

```javascript
setupApp({ name: "vue3", url: "...", alive: true });
```

- 只渲染一次，切走保留内存中的 webcomponent
- **改 url 不会改变子应用路由** → 见 [routing.md](routing.md)
- 切走后仍可响应 bus 事件
- 适合多 Tab、频繁切换、需保留表单状态

### 单例模式

多菜单页共享同一 `name`，不同 `url`：

```
销毁当前实例 → 同步新路由 → 创建新实例
```

需子应用生命周期改造（见 sub-app.md）。

### 重建模式

每次切换销毁一切。改 `url` 可跳路由。主动全量重建用 `refreshApp` 或组件 `refresh()`。

---

## sync 路由同步

```vue
<WujieVue name="vue3" :url="url" :sync="true" />
```

- 子应用 `path+query+hash` 编码到主应用 URL query（key = `name`）
- 刷新/前进/后退可恢复子应用路由
- **仅初次实例化从 URL 读回**；之后单向同步到主应用
- `sync: false` 时子应用跳转不改主应用 URL，但 history 仍增加

路由跳转实现见 [routing.md](routing.md)，不要与手动 bus 同步重复使用。

---

## prefix 短路径

sync 时缩短 URL：

```javascript
prefix: {
  prod: "/example/prod",
  test: "/example/test",
  prodId: "/example/prod/debug?id=",
}
```

`/example/prod/hello` → query 中为 `{prod}/hello`（最长匹配）。

---

## degrade 降级

```javascript
{
  degrade: true;
}
```

子应用降级为原生 iframe 方案（弹窗、兼容性问题时使用）。`degradeAttrs` 配置降级 iframe 属性。

自动降级条件（框架封装 demo）：`!window.Proxy || !window.CustomElementRegistry`

---

## fiber 分片执行

```javascript
{
  fiber: true;
}
```

用 `requestIdleCallback` 分片执行 JS，避免长任务阻塞主线程。

**注意**：可能影响脚本执行顺序（Issue #1025），有严格顺序依赖的脚本慎用。

---

## 预加载策略

```javascript
setupApp({ name: "vue3", url: "...", exec: true });
preloadApp({ name: "vue3" });
```

| 配置         | 效果                                 |
| ------------ | ------------------------------------ |
| `preloadApp` | 空闲时加载 HTML/JS/CSS               |
| `exec: true` | 预加载时执行 JS（打开接近 SSR 速度） |

**最佳实践**（Issue #1029）：

- 只预加载首屏需要的 1～3 个子应用
- 不要 `preloadApp` 全部子应用
- 其余子应用路由进入时再加载
- 大型子应用：`setupApp` + `exec: true` + `preloadApp`

---

## 性能优化清单

```
- [ ] 首屏子应用 preload + exec
- [ ] 非首屏子应用按需加载
- [ ] 大型子应用考虑 fiber（注意脚本顺序）
- [ ] 自定义 fetch 加超时，避免单资源阻塞（见 deployment.md）
- [ ] 生产环境正确配置缓存策略
- [ ] 子应用发版后 clearAssetsCache
```

---

## 存储隔离

| 场景         | localStorage / sessionStorage |
| ------------ | ----------------------------- |
| 主子应用同域 | **共享**                      |
| 跨域         | 各自独立                      |

Issue #1055

---

## 保活副作用

- 主应用未打开子应用页面时，保活 + 预执行可能导致子应用全局组件（如通知）在主应用显示（Issue #1033）
- 解决：不用保活；或子应用入口判断是否在容器内再挂载全局 UI
