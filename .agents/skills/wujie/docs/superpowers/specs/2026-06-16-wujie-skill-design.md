# wujie-skill 设计规格

> 日期：2026-06-16  
> 状态：已评审通过，待实现  
> 适配 wujie 版本：以 `wujie-core/package.json` 当前版本为准

## 1. 背景与目标

无界（wujie）是腾讯开源的微前端框架，官方资料分散在 `master/docs`（VitePress 文档）、`master/packages`（源码）和 `master/examples`（demo）。用户在使用 AI 接入 wujie 时，往往需要反复查询文档，且文档与真实行为、社区 issue 之间存在信息差。

**目标**：开发 `wujie-skill`，用户通过 `npx skills add` 安装后，AI 可自动加载该 skill，无需再查官方文档，即可完成 wujie 主/子应用接入与排障。

## 2. 需求决策（已确认）

| 维度     | 决策                                                             |
| -------- | ---------------------------------------------------------------- |
| 服务对象 | 业务接入者（主/子应用集成），非框架贡献者                        |
| 内容策略 | 手工精编；**先读源码理解真实行为 → 校验 docs/examples → 再提炼** |
| 分发方式 | `wujie-skill` 独立仓库 + Skills CLI（`npx skills add`）          |
| 触发方式 | 自动触发（提到 wujie、无界、微前端、子应用接入等关键词）         |
| 语言     | 中文为主                                                         |
| 结构方案 | Hub + 渐进式 Reference（方案一）                                 |

## 3. 内容生产流程

```
wujie-core 源码 ──┐
框架封装源码     ──┼──► 理解真实行为与边界
docs + examples  ──┘         │
                             ▼
                      交叉校验（文档准确性、示例是否最佳实践）
                             │
                             ▼
                    提炼写入 skill（SKILL.md + references/）
```

**每个 reference 文件包含：**

1. **是什么** — 面向接入者，非实现细节
2. **怎么用** — 最小可运行示例（来自 examples 验证过的模式）
3. **注意点** — 源码行为 vs 文档描述的差异（若有）
4. **常见坑** — FAQ / GitHub Issue 中反复出现的问题

**明确不写的内容：**

- `shadow.ts`、`proxy.ts` 等内部实现细节
- 贡献者级调试指南、源码级 patch 指引

## 4. 仓库结构

```
wujie-skill/
├── SKILL.md                          # ≤400 行：决策入口
├── README.md                         # 安装与使用说明
└── references/
    ├── api.md                        # 主应用 API + 子应用 $wujie
    ├── main-app.md                   # Vue2/Vue3/React 主应用封装
    ├── sub-app.md                    # 子应用改造要点
    ├── modes.md                      # alive/sync/degrade/fiber/预加载/性能
    ├── routing.md                    # 路由跳转专题（含多 Tab）
    ├── communication.md              # bus/props/window.parent 机制
    ├── plugin-lifecycle.md           # 插件 + 生命周期
    ├── deployment.md                 # 部署、发版、缓存、fetch
    └── faq.md                        # 30+ 条 issue 驱动排障索引
```

## 5. SKILL.md 设计

### 5.1 Frontmatter

```yaml
---
name: wujie
description: >
  无界（wujie）微前端框架接入指南。涵盖主/子应用集成、Vue2/Vue3/React 组件封装、
  startApp/setupApp/preloadApp API、路由同步与跳转、保活预加载、bus 通信、插件与生命周期、
  子应用改造、部署排障与常见问题。当用户提到 wujie、无界、微前端、子应用接入、
  主应用加载子应用时使用。
---
```

不设 `disable-model-invocation`，以支持自动触发。

### 5.2 正文章节

| 章节                | 内容                                                          |
| ------------------- | ------------------------------------------------------------- |
| 框架速览            | iframe + WebComponent 方案，与 qiankun/iframe 差异（3～5 句） |
| 包选择矩阵          | `wujie` / `wujie-vue2` / `wujie-vue3` / `wujie-react`         |
| 接入决策树          | 路由到对应 reference 文件                                     |
| 最小接入示例        | Vue3 主应用 + 子应用各一段（examples 验证）                   |
| Reference 索引      | 每个文件「何时读」+ 一行摘要                                  |
| AI 工作流 Checklist | 接入任务标准步骤                                              |

### 5.3 接入决策树

```
用户问题
  ├─ 主应用框架? → main-app.md（vue2/vue3/react）或 api.md#startApp
  ├─ 子应用改造? → sub-app.md
  ├─ 路由/菜单/跳转/多Tab? → routing.md
  ├─ 运行模式/性能/预加载? → modes.md
  ├─ 通信? → communication.md
  ├─ 插件/生命周期? → plugin-lifecycle.md
  ├─ 部署/发版/404/缓存? → deployment.md
  └─ 报错/组件异常? → faq.md（先查索引，再深入对应 reference）
```

### 5.4 AI 工作流 Checklist

```
接入任务：
- [ ] 确认主应用框架，选择对应 npm 包
- [ ] 确认子应用是否需要改造（通常极少）
- [ ] 确定运行模式：默认 / alive / degrade
- [ ] 是否需要路由同步（sync）或预加载（preloadApp）
- [ ] 通信方式：props / bus / window.parent
- [ ] 按需读取 references，不猜测 API 参数
- [ ] 给出代码前对照 examples 中的真实写法
```

### 5.5 Token 控制

- SKILL.md 只放决策 + 索引 + 最小示例
- 详细参数表、插件配置、排障 → 按需读 `references/`
- 单次对话通常只读 1～2 个 reference 文件

## 6. Reference 文件规格

### 6.1 `api.md`

- `setupApp`、`startApp`、`preloadApp`、`destroyApp`、`refreshApp`、`clearAssetsCache`
- `bus` 事件 API
- 子应用 `$wujie`（bus / props / shadowRoot / location）
- 源码依据：`wujie-core/src/index.ts`、`event.ts`、`sandbox.ts`
- 勘误：vite 子应用 `location` 代理限制

### 6.2 `main-app.md`

- Vue2 / Vue3 / React 安装注册
- 组件 Props 与 startApp 参数映射
- 组件方法 `refresh()`、bus `@event` 监听
- 与 `setupApp` + `preloadApp` 配合写法
- 参照：`packages/wujie-vue2|vue3|react`、`examples/main-vue`、`examples/main-react`

### 6.3 `sub-app.md`

- CORS / cookie（`fetch credentials: include`）
- 零改造条件
- 生命周期改造：`__WUJIE_MOUNT` / `__WUJIE_UNMOUNT` / `__WUJIE.mount()`
- 框架示例索引：vue2 / vue3 / vite / react16 / react17 / angular12
- `window.__POWERED_BY_WUJIE__` 环境检测
- vite：`$wujie.location` 替代 `window.location`
- Module Federation：`library.type: 'window'`
- 动态 style / `v-html` 图片路径：`__WUJIE_PUBLIC_PATH__`
- 地图类库接入注意（Issue #195）

### 6.4 `modes.md`

- 单例 / 保活 / 重建三种模式
- `sync` 路由同步、`prefix` 短路径
- `alive` 保活、`degrade` 降级、`fiber` 分片执行
- 预加载策略：按需 preload、exec 模式、空闲加载（Issue #1029）
- 大型子应用性能：preload + exec + fiber（Issue #1022）
- fiber 脚本顺序注意（Issue #1025）
- 同域 localStorage 共享说明（Issue #1055）
- sync/prefix 配置细节；文末引用 `routing.md` 做跳转实现

### 6.5 `routing.md`（路由专题）

| 章节                      | 内容                                       | 参照                                   |
| ------------------------- | ------------------------------------------ | -------------------------------------- |
| 主应用路由架构            | 双层结构 `/{app}` + `/{app}-sub/:path`     | `examples/main-vue/router` + `App.vue` |
| 三种路由模式选型          | sync 自动同步 / 双层路由+bus / props.jump  | `Vue3.vue` vs `Vue3-sub.vue`           |
| 子应用→主应用（菜单联动） | `sub-route-change` 完整链路                | `vue3/App.vue` + `main.js`             |
| 主应用→子应用（保活模式） | 改 url 无效；`xxx-router-change` 反向通信  | `Vue3-sub.vue`                         |
| 子应用间跳转              | `props.jump`、指定子路由 query、保活用 bus | `docs/guide/jump.md`                   |
| hash 主应用               | query 挂 hash 后的手动处理                 | `docs/guide/jump.md`                   |
| prefix 短路径             | 与路由同步配合                             | `main.js` setupApp                     |
| **多标签页架构**          | 同 name 冲突、一 Tab 一实例、保活+标签     | Issue #391、#516、#585                 |
| deep link                 | 直接打开子应用某路由加载不到               | Issue #1075                            |
| sync 双渲染               | 组件/请求执行两次                          | Issue #328                             |
| 浏览器后退异常            | 刷新后后退多次无反应                       | Issue #308                             |
| history.state 限制        | 不支持场景与替代                           | Issue #1043                            |
| sync URL 参数叠加         | 刷新后 query 重复                          | Issue #1045                            |
| 常见误区                  | 只改 url、保活+sync 混用失效等             | 源码 + FAQ                             |

### 6.6 `communication.md`

- props / bus / window.parent 对照表
- 主应用跳转子应用路由、子应用通知主应用换路由（`sub-route-change`）
- 保活模式下 bus 监听时机（Issue #1020）
- 路由场景详细实现引用 `routing.md`，避免重复

### 6.7 `plugin-lifecycle.md`

- 插件类型：htmlLoader / jsLoader / cssLoader / hooks
- 生命周期：beforeLoad → afterUnmount + activated/deactivated
- 保活模式钩子差异
- `__WUJIE_RAW_WINDOW__` 使用场景
- iframe `attrs: { src: '...' }` 空页方案（Issue #54）
- Element Plus popper 容器与 destroy 问题

### 6.8 `deployment.md`（新增）

- 主子应用同域/跨域部署
- nginx：`index.html` 不缓存、静态资源 hash
- 子应用发版后 `clearAssetsCache`（Issue #1028）
- 生产环境 `base` 路径（Issue #1044）
- 自定义 `fetch` 模板（credentials、超时，Issue #1057）

### 6.9 `faq.md`

每条格式：**现象 → 原因（源码级一句话）→ 解决方案 → 相关 Issue #**

**P0 高频（优先实现）：**

| 主题                         | Issue             |
| ---------------------------- | ----------------- |
| 主应用如何跳转到子应用       | #1026、#46        |
| 保活下改 url 无效            | examples + #1052  |
| CORS / 沙箱被替换            | #71、#10          |
| 第三方 var 全局变量          | #326、#1056       |
| vite window.location         | #1031             |
| 下拉/弹层错位                | #73、#682、#824   |
| 子应用部署后 404             | #1028             |
| fetch 超时白屏               | #1057             |
| Target container 不是 DOM    | #1041             |
| 多 Tab 同 name 冲突          | #391、#516        |
| destroyApp 后 props 丢失     | #1054             |
| 直接打开子路由加载不到       | #1075             |
| window.addEventListener 失效 | #549              |
| a 标签 blank / window.close  | #1065、#1066      |
| 富文本编辑器异常             | #479、#513、#1096 |

**P1：**

- vite 样式丢失（#434）、JS 执行两遍（#1049、#1027）
- 弹窗内嵌无界崩溃（#1039）
- Web Components（#1047、#1061）
- Chrome 142 + alive + el-form（#1034、#1036）

**P2/P3（标注边界，不推荐方案）：**

- 孙应用/嵌套微前端（#1040）→ 建议 iframe
- Cesium / OnlyOffice（#1024、#1083）→ 沙箱限制说明

## 7. 实现优先级

| 优先级 | 交付物                                                               |
| ------ | -------------------------------------------------------------------- |
| P0     | `SKILL.md` + `routing.md` + `faq.md`（高频 15 条）+ `api.md`         |
| P1     | `main-app.md` + `sub-app.md` + `deployment.md` + `modes.md` 性能章节 |
| P2     | `communication.md` + `plugin-lifecycle.md` + `faq.md` 剩余条目       |
| P3     | README 完善、skills.sh 发布说明                                      |

## 8. 验证方式

1. 用 10 个典型接入/排障问题测试 AI 是否仅靠 skill 即可正确回答
2. 对照 `examples/` 检查生成代码是否与官方 demo 一致
3. `SKILL.md` ≤ 400 行；reference 仅从 SKILL.md 一层引用
4. description 含中英文触发词（wujie、无界、微前端）

## 9. 版本维护

- `README.md` 和 `SKILL.md` 头部标注适配 wujie 版本
- wujie 大版本发布时人工 review 更新 skill（不做自动同步脚本）
- API 变更在 reference 内用「版本注意」标注

## 10. 内容来源索引

| 来源       | 路径                              | 用途                |
| ---------- | --------------------------------- | ------------------- |
| 核心源码   | `master/packages/wujie-core/src/` | 验证 API 行为与边界 |
| 框架封装   | `master/packages/wujie-vue2       | vue3                | react/` | 组件 Props 与封装差异 |
| 官方文档   | `master/docs/`                    | 交叉校验            |
| 示例       | `master/examples/`                | 可运行写法取样      |
| 社区 Issue | `github.com/Tencent/wujie/issues` | 高频困惑与排障      |

## 11. 下一步

用户 review 本 spec 通过后，调用 writing-plans skill 生成实现计划，在 `wujie-skill` 仓库按 P0→P3 顺序编写文件。
