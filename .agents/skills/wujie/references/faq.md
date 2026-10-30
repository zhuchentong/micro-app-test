# 常见问题排障

格式：**现象 → 原因 → 解决方案**。先在本页查索引，再深入对应 reference。

---

## 路由与跳转

### 主应用如何跳转到子应用？

- **现象**：不知道如何从主应用菜单打开子应用页面
- **原因**：需要主应用自己的路由 + WujieVue 组件，不是直接改子应用 url
- **解决**：设计双层路由 `/{app}` + `/{app}-sub/:path`，菜单用 `router-link`；保活用 bus。详见 [routing.md](routing.md)
- **Issue**：#1026、#46

### 保活模式下改 url 无效

- **现象**：修改 WujieVue 的 `url` prop，子应用页面不变
- **原因**：`alive: true` 时复用 iframe 实例，不根据新 url 走路由
- **解决**：bus 发 `xxx-router-change`，子应用 `$router.push` 监听
- **Issue**：#1052

### 直接打开子应用某路由加载不到

- **现象**：带 sync query 的 URL 直接访问，子应用不是预期页面
- **原因**：保活已实例化不会重读 URL；或 mount 时机不对
- **解决**：双层路由 + sync；确保初次实例化前 URL 正确。见 [routing.md#9](routing.md)
- **Issue**：#1075

### 多 Tab 切换后子应用无法挂载

- **现象**：主应用多标签页，切换后子应用白屏或状态错乱
- **原因**：多 Tab 共用同一 `name`，保活实例冲突
- **解决**：每 Tab 唯一 `name` 或独立实例。见 [routing.md#8](routing.md)
- **Issue**：#391、#516

### sync 导致组件渲染/请求两次

- **现象**：开启 sync 后生命周期执行两遍
- **原因**：sync 自动同步与手动 `sub-route-change` 重复触发路由
- **解决**：只保留一种同步方式
- **Issue**：#328

---

## 接入与跨域

### CORS 报错 / 资源被拦截

- **现象**：`blocked by CORS policy`
- **原因**：子应用资源从主应用域名请求，跨域
- **解决**：子应用服务端配置 CORS；cookie 场景 `fetch` 设 `credentials: 'include'`，且 `Allow-Origin` 不能为 `*`
- **Issue**：#502

### 沙箱被替换 / cross-origin frame 报错

- **现象**：`Blocked a frame with origin from accessing a cross-origin frame`
- **原因**：iframe src 302 跳转；vite 改 `window.location.href`；jsIgnores 脚本改 location
- **解决**：`attrs: { src: 'https://host/empty' }` 空页；vite 用 `$wujie.location`；jsIgnores 脚本同样
- **Issue**：#71、#10

### Target container is not a DOM element

- **现象**：子应用无法加载，报容器不存在
- **原因**：`startApp` 时 `el` 对应 DOM 尚未挂载
- **解决**：确保容器在 `mounted` 后渲染；Vue 用 `ref` 容器
- **Issue**：#1041

---

## 全局变量与脚本

### 第三方包 var 全局变量找不到

- **现象**：`xxx is not defined`，独立运行正常
- **原因**：脚本在闭包内执行，`var xxx` 无法挂到 window
- **解决**：改 `window.xxx`；或 webpack `output.libraryTarget: 'window'`；或 jsLoader 插件替换
- **Issue**：#326、#1056

### window.addEventListener 失效

- **现象**：子应用注册的事件监听不触发
- **原因**：事件注册在代理 window 上，与预期不符
- **解决**：使用插件 `windowAddEventListenerHook`；或注册到 `$wujie` 提供的 bus
- **Issue**：#549

### Module Federation 远程模块报错

- **现象**：微前端内 federation 加载失败
- **原因**：同 var 全局变量问题
- **解决**：`library: { type: 'window', name: '与name一致' }`
- **参考**：docs/question #7

---

## Vite 子应用

### window.location 是主应用地址

- **现象**：Vite 子应用 `location.host` 不对
- **原因**：ESM 脚本无法闭包劫持 location
- **解决**：统一改用 `window.$wujie.location`
- **Issue**：#1031

### vite 切换路由样式丢失

- **现象**：vite4 子应用路由切换后 CSS 丢失
- **原因**：vite HMR / CSS 注入与 shadow 交互问题
- **解决**：参考 Issue #434 方案；或 cssExcludes / 插件处理
- **Issue**：#434

### JS 执行两遍 / 首屏变慢

- **现象**：微应用内 JS 加载执行两次
- **原因**：modulepreload 或预加载与正式加载重复
- **解决**：检查 `jsExcludes`；避免重复 preload + startApp
- **Issue**：#1049、#1027

---

## UI 组件兼容

### 下拉框/弹层位置错位

- **现象**：Element/Ant Design Select、Popover 弹出位置偏移
- **原因**：popper 计算到 `window.visualViewport`，shadow 内无此滚动量
- **解决**：子应用 `body { position: relative }`；新版框架已优化 popper 定位
- **Issue**：#73、#682、#824、#380

### 富文本编辑器异常

- **现象**：wangeditor / Quill / CKEditor / Monaco 在无界内失焦、选区异常
- **原因**：shadow DOM 事件 target、selection 与原生差异
- **解决**：新版已修复部分问题；wangEditor 可用 InstanceofPlugin；Monaco 需额外配置
- **Issue**：#479、#513、#1096、#768、#205

### e.target 变成 wujie-app

- **现象**：异步事件里 `e.target` 不是原始元素
- **原因**：shadow DOM 事件重定向
- **解决**：`(e.target.shadowRoot && e.composed) ? (e.composedPath()[0] || e.target) : e.target`

### 字体 / iconfont 不生效

- **现象**：子应用自定义字体或图标不显示
- **原因**：`@font-face` 在 shadow 内加载限制
- **解决**：框架已将 font-face 提升到 shadow 外；主/子字体名勿重复
- **Issue**：#1040（孙应用更复杂，建议 iframe）

---

## 部署与性能

### 子应用发版后资源 404

- **现象**：重新部署子应用，主应用访问旧 hash 资源 404
- **原因**：wujie 缓存了旧 HTML/JS/CSS
- **解决**：`clearAssetsCache()`；nginx 不缓存 `index.html`
- **Issue**：#1028

### fetch 超时导致长时间白屏

- **现象**：某个脚本请求超时，整个子应用卡住
- **原因**：脚本串行队列等待超时资源
- **解决**：自定义 `fetch` 加超时 AbortController。见 [deployment.md](deployment.md)
- **Issue**：#1057

### 子应用多、预加载卡顿

- **现象**：preload 所有子应用首屏卡死
- **原因**：同时预加载资源过多
- **解决**：只 preload 首屏需要的；`exec: true` 慎用；空闲时加载其余
- **Issue**：#1029

---

## 状态与生命周期

### destroyApp 后 props 访问不到

- **现象**：销毁重建后 `$wujie.props` 为空
- **原因**：销毁清除了注入；需等重新 mount
- **解决**：在 `afterMount` 后再读 props；或保活避免销毁
- **Issue**：#1054

### 保活模式下 bus 收不到

- **现象**：主应用切走后再 emit，子应用无响应
- **原因**：监听写在已销毁的组件上；或 `$on` 未在保活实例中注册
- **解决**：bus 监听放子应用入口（App.vue mounted），非页面级组件；保活切走仍会响应
- **Issue**：#1020

### 主子应用是否共享 localStorage

- **现象**：不清楚存储是否互通
- **原因**：iframe 与主应用同域时共享
- **解决**：同域共享 sessionStorage/localStorage；跨域各自独立
- **Issue**：#1055

---

## 边界场景

### a 标签 target=_blank / window.close 无效

- **现象**：子应用打不开新窗口、关不了页
- **原因**：iframe 沙箱限制
- **解决**：`window.open` 替代；关闭操作用主应用通信处理
- **Issue**：#1065、#1066

### 弹窗内嵌无界反复开关后白屏

- **现象**：Modal 里嵌子应用，多次开关崩溃
- **原因**：容器反复挂载销毁时序问题
- **解决**：弹窗关闭时 `destroyApp`；或弹窗内用 iframe 降级
- **Issue**：#1039

### Web Components 无法渲染

- **现象**：子应用自定义元素不显示
- **原因**：主应用未注册对应 custom element
- **解决**：主应用也注册该 web-component
- **Issue**：#1047、#1061

### Chrome 142 + alive + el-form 崩溃

- **现象**：保活子应用 form 输入后切页浏览器崩溃
- **原因**：Chrome 142 特定版本 bug
- **解决**：升级 Chrome >= 142.0.7444.163；或临时关闭 alive
- **Issue**：#1034、#1036

### 孙应用 / 嵌套微前端

- **现象**：子应用内再嵌子应用出各种问题
- **原因**：复杂度过高，字体/路由/沙箱叠加
- **解决**：**不推荐**；必须用时内层用原生 iframe
- **Issue**：#1040

### Cesium / OnlyOffice 等重型库

- **现象**：子应用内地球/文档编辑器异常
- **原因**：Worker、沙箱对全局 API 限制
- **解决**：评估降级 `degrade: true`；或独立 iframe 打开
- **Issue**：#1024、#1083
