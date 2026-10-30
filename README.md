# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```

## Store 同步(host → 子应用)

各应用持有独立的 pinia 实例(子应用在 wujie 沙箱内),但共享 `@repo/store` 中同一份 `defineStore` 定义。host 是状态权威源:初始值(user/theme)经 `startApp` 的 props 水合到子应用 store,后续变更经 wujie bus 以 `host:state` 事件全量广播,子应用按 `rev` 判重后 `$patch` 到本地 store。子应用注册监听后还会发送 `sub:state-request` 握手,host 收到即回发当前快照 —— 保证注册后立即拿到最新状态,避免 host 启动早期的广播无人订阅。

```text
初始同步:子应用 register → bus "sub:state-request" → host 回发当前快照(全量 + rev)
运行时同步:host store 变更 → bus "host:state"(全量快照 + rev)→ 子应用按 rev 判重 → $patch 本地 store
```

- host(`apps/host`):`initWujie` + `createHostStoreSync`,负责广播快照
- 子应用(`apps/sub-app-a` / `apps/sub-app-b`):mount 回调内 `createSubStoreSync({ pinia })`,负责水合与监听
- 契约:`packages/wujie-kit`(`appEvents.state`)+ `packages/store`(`useThemeStore` / `useUserStore` / `createSubStoreSync`)
