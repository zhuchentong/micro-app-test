# @repo/store — 共享 pinia store 与 host→子应用单向同步

契约机制概述见根 README「Store 同步」，此处只记录 README 未覆盖的实现纪律。

- **入口区分**：host 用 `@repo/store/host`，子应用用 `@repo/store/sub`；根导出 `.` 只含 store 定义与同步器工厂（src/index.ts:3）。
- **新增"需同步的 store"必改 4 处**（漏一处即静默失效）：
  1. `src/stores/<name>.ts` — store 定义；
  2. `src/host.ts:36-43` — 订阅该 store 并把字段**硬编码**进 `emitSnapshot()` 快照（现有 user/theme/custom 逐字段拼装）；
  3. `@repo/wujie-kit` 的 `HostStatePayload`（wujie-kit/src/events.ts:40）— 快照契约类型；
  4. `src/sub.ts:34-42` — `handler` 内水合/回写新字段。
- **漂移方向警示**：payload 新增字段而 `sub.ts` 未同步时**静默丢失**——不报编译错、不报运行错，子应用永远拿不到该字段。
- 快照按 `rev` 单调序号判重：`payload.rev <= lastRev` 直接丢弃（src/sub.ts:36）。
- host 侧 watch 源是浅拷贝对象：引用类型字段（如 `custom`）必须**整体替换**才能被感知（src/host.ts:45-50）。
