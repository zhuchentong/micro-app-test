import { defineStore } from "pinia";
import { formatClockTime } from "@repo/share";

/** bus 消息日志条目(host 侧事件流水,最新在前) */
export interface LogEntry {
  id: number;
  time: string;
  source: string;
  text: string;
}

/** 日志上限:超出裁剪最旧(与原 App.vue 内联逻辑一致) */
const LOG_LIMIT = 50;

/** host 内部日志状态:布局无关,WorkspaceLayout 的日志面板与 Workbench 的关闭 Tab 日志共享 */
export const useLogsStore = defineStore("logs", {
  state: () =>
    ({
      entries: [] as LogEntry[],
      seq: 0,
    }) as { entries: LogEntry[]; seq: number },
  actions: {
    /**
     * 新增一条日志:unshift 最新在前,id 自增,超上限裁剪最旧
     * @param source 来源标识(如 "host" / 子应用 key)
     * @param text 日志正文
     */
    add(source: string, text: string): void {
      this.entries.unshift({ id: ++this.seq, time: formatClockTime(new Date()), source, text });
      if (this.entries.length > LOG_LIMIT) this.entries.length = LOG_LIMIT;
    },
  },
});
