/**
 * wujie 注入的全局对象类型声明。
 * 经 index.ts 副作用 import 挂载,应用侧无需各自维护 env.d.ts 全局类型。
 */
declare global {
  /** 主应用通过 startApp props 注入的数据 */
  interface WujieProps {
    user?: { id: string; name: string };
    theme?: string;
  }

  interface WujieBus {
    $on<T = unknown>(event: string, callback: (data?: T) => void): void;
    $emit(event: string, data?: unknown): void;
    $off(event: string, callback?: (data?: unknown) => void): void;
  }

  interface WujieInstance {
    props?: WujieProps;
    bus?: WujieBus;
    location?: Location;
  }

  interface Window {
    __POWERED_BY_WUJIE__?: boolean;
    __WUJIE?: { mount: () => void };
    __WUJIE_MOUNT?: () => void;
    __WUJIE_UNMOUNT?: () => void;
    $wujie?: WujieInstance;
  }
}

export {};
