import type { BadgeVariants } from "../badge";
import type { ButtonVariants } from "../button";
import type { VNodeChild } from "vue";
import type { DataRecord, TableColumnOptions } from "./types";
import { h } from "vue";
import Badge from "../badge/Badge.vue";
import Button from "../button/Button.vue";

/** 单元格渲染器：与 TableColumnOptions.render 同签名（column 用于读取字段值） */
export type ColumnRender<T extends DataRecord> = (
  record: T,
  index: number,
  column: TableColumnOptions<T>,
) => VNodeChild;

export type DictEntryVariant = BadgeVariants["variant"];

export type DictColumnMapping = Record<
  string | number,
  string | { label: string; variant?: DictEntryVariant }
>;

export interface DictColumnOptions {
  /** 整列统一 Badge 形态；条目级 variant 优先 */
  badge?: DictEntryVariant | true;
}

/** 日期模式串（迷你令牌 yyyy MM dd HH mm ss），如 "yyyy-MM-dd HH:mm" */
export type DateColumnPattern = string;

export interface SerialColumnOptions {
  /** 起始序号，默认 1 */
  base?: number;
}

export interface TableActionButton<T extends DataRecord> {
  text: string | ((record: T, index: number) => string);
  onClick?: (record: T, index: number) => void;
  variant?: ButtonVariants["variant"];
  disabled?: (record: T, index: number) => boolean;
}

export interface ColumnRenders<T extends DataRecord> {
  /** 逃逸口：自定义渲染器与内置同一范式（对齐 x-render renderRenderColumn） */
  render: (fn: ColumnRender<T>) => ColumnRender<T>;
  dict: (mapping: DictColumnMapping, options?: DictColumnOptions) => ColumnRender<T>;
  date: (pattern?: DateColumnPattern) => ColumnRender<T>;
  currency: (currency?: string, locale?: string) => ColumnRender<T>;
  serial: (base?: number) => ColumnRender<T>;
  /** 操作列按钮组；按钮组为行内级（inline-flex），随单元格 align 对齐（默认居中） */
  button: (items: Array<TableActionButton<T> | string>) => ColumnRender<T>;
}

/**
 * 两位补零
 * @param value - 数字（月/日/时/分/秒）
 * @returns 补零后的两位字符串
 */
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * 迷你日期令牌格式化，不引入 date-fns；非法输入原样返回
 * @param input - 单元格原始值（Date 或可构造 Date 的字符串/数字）
 * @param pattern - 令牌模板（支持 yyyy/MM/dd/HH/mm/ss）
 * @returns 格式化后的文本；输入非法时原样返回
 */
function formatDate(input: unknown, pattern: string): VNodeChild {
  const date = input instanceof Date ? input : new Date(input as string | number);
  if (Number.isNaN(date.getTime())) return input as VNodeChild;
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => tokens[token]!);
}

/**
 * 内置列渲染器工厂（对标 x-render table-columns，v1：dict/date/currency/serial/button）。
 * 返回值直接填入 TableColumnOptions.render；column 参数用于读取字段值。
 * 与 FormRender widget 的 r.xxx() 范式共词根（D10）。
 * @returns 各内置渲染器集合（render/dict/date/currency/serial/button）
 */
export function columnRenders<T extends DataRecord>(): ColumnRenders<T> {
  return {
    render: (fn) => fn,

    dict(mapping, options) {
      return (record, _index, column) => {
        const raw = (record as Record<string, unknown>)[column.key];
        const entry = mapping[raw as string | number];
        if (entry === undefined) return (raw ?? "") as VNodeChild;

        const label = typeof entry === "string" ? entry : entry.label;
        const entryVariant = typeof entry === "object" ? entry.variant : undefined;
        // Badge 形态：条目级 variant，或整列 badge 简写
        if (entryVariant !== undefined || options?.badge !== undefined) {
          const variant = entryVariant ?? (options?.badge === true ? undefined : options?.badge);
          return h(Badge, { variant }, () => label);
        }
        return label;
      };
    },

    date(pattern = "yyyy-MM-dd") {
      return (record, _index, column) =>
        formatDate((record as Record<string, unknown>)[column.key], pattern);
    },

    currency(currency = "CNY", locale = "zh-CN") {
      const format = new Intl.NumberFormat(locale, { style: "currency", currency });
      return (record, _index, column) => {
        const raw = (record as Record<string, unknown>)[column.key];
        const value = typeof raw === "string" ? Number(raw) : raw;
        if (typeof value !== "number" || Number.isNaN(value)) return raw as VNodeChild;
        return format.format(value);
      };
    },

    serial(base = 1) {
      return (_record, index) => index + base;
    },

    // inline-flex（行内级）：按钮组随单元格 align 对齐（默认居中）；块级 flex 占满单元格、恒左起
    button(items) {
      return (record, index) => {
        if (items.length === 0) return "";
        return h(
          "div",
          { class: "inline-flex items-center gap-1" },
          items.map((item) => {
            const action = typeof item === "string" ? { text: item } : item;
            return h(
              Button,
              {
                size: "sm",
                variant: action.variant ?? "link",
                disabled: action.disabled?.(record, index),
                onClick: () => action.onClick?.(record, index),
              },
              () => (typeof action.text === "function" ? action.text(record, index) : action.text),
            );
          }),
        );
      };
    },
  };
}
