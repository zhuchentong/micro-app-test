import { ref, type ComponentInternalInstance } from "vue";

export interface ConfirmPendingOptions {
  /** 当前组件实例：从 vnode 上取原始 onConfirm 监听器（emit 不回传返回值） */
  instance: ComponentInternalInstance | null;
  /** 无监听器时补发 confirm 事件 */
  emitConfirm: () => void;
  emitCancel: () => void;
  /** 关闭弹层（走受控桥） */
  close: () => void;
}

/**
 * 确认弹层公共 pending 语义：@confirm 处理器返回 Promise 时锁定关闭通道，
 * resolve 后自动关闭，reject 保持打开并退出 loading；同步处理器直接关闭。
 */
export function useConfirmPending(options: ConfirmPendingOptions) {
  const loading = ref(false);

  function handleConfirm() {
    if (loading.value) return;
    const handler = options.instance?.vnode.props?.onConfirm as
      | ((...args: unknown[]) => unknown)
      | undefined;
    const result = handler?.();
    if (!handler) options.emitConfirm();
    if (result instanceof Promise) {
      loading.value = true;
      result
        .then(() => {
          loading.value = false;
          options.close();
        })
        .catch(() => {
          loading.value = false;
        });
    } else {
      options.close();
    }
  }

  function handleCancel() {
    if (loading.value) return;
    options.emitCancel();
    options.close();
  }

  return { loading, handleConfirm, handleCancel };
}
