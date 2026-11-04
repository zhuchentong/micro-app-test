import type { SyncBus } from "./types";

/**
 * 保持 bus 事件常驻订阅者,静音 wujie 的空订阅告警。
 * 背景:wujie EventBus.$emit 在"该事件在所有实例中均无订阅者"时打 warn
 * ("事件订阅数量为空")。host 启动期早于子应用挂载广播快照属握手设计容忍的
 * 空发(子应用注册后经 sub:state-request 握手补发全量快照),此告警纯为底噪。
 *
 * @param bus    目标 bus(真实 wujie bus 或测试 mock,仅需 SyncBus 结构)
 * @param events 常驻事件名(可变参数,如 appEvents.state)
 * @returns 注销函数(幂等,重复调用安全)
 */
export function keepBusEventAlive(bus: SyncBus, ...events: string[]): () => void {
  // 占位监听不碰 store、不产生副作用,仅让 $emit 的空订阅检查通过
  const idle = (): void => {};
  for (const event of events) bus.$on(event, idle);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const event of events) bus.$off(event, idle);
  };
}
