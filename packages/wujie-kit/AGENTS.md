# @repo/wujie-kit — wujie 主/子应用通信契约

- **`src/events.ts` 的 `appEvents` 是 bus 事件名单一来源**（三端共用，events.ts:1）：新增事件必须在此登记 + 定义 payload 接口 + host/sub/apps 三侧接线。**禁止裸字符串调用 `bus.$emit/$on/$off`**——注意这是约定而非 lint 强制（无规则兜底），目前全仓零违例，请保持。
- **`keepBusEventAlive`**（./bus 导出，bus.ts:13）：wujie 对空订阅事件会告警，常驻事件（如 `host:state`）需占位订阅静音；启动期 host 广播先于子应用订阅，空发由 `sub:state-request` 握手兜底（用法示例：store/src/host.ts:30-32）。
- 子路径导出：`.`（契约与类型）、`./bus`、`./host`、`./sub`（package.json exports）——消费方按所在侧选入口，勿从 `.` 深挖内部路径。
- **命名轴契约**（历经 subBus→microBus→appBus 多轮裁定后固化，勿再反复）：
  - `Host*` / `Sub*` — 通信角色轴（宿主侧/子应用侧），与总线事件名 `host:`/`sub:` 前缀、包导出 `./host`·`./sub` 严格同轴，**禁止改写为其他词根**（`Micro*`/`App*`/无前缀均已评估并否决）。
  - `MicroApp*` — 应用身份轴（`MicroAppManifest` 等），描述任一注册进 host 的应用，host 侧同样消费；注意 `micro-*` 是仓库应用目录轴（`micro-host` 也在内，≠"子应用侧"）。
  - `App*` — 子应用侧组合根工厂与应用侧句柄：`createAppBus` → `{ appBus, openTab }`；`createBus` 为原语工厂，层级低于 `createAppBus`。
  - 类型命名只允许在所属轴内取词；跨轴引用仅限"身份子集"场景（如 `SubAppIdentity` 沿袭 `MicroAppManifest`）。
