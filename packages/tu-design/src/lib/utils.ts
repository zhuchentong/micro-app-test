import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 className:clsx 串联条件类名,再经 tailwind-merge 消除冲突的 Tailwind 类(后者胜出)
 * @param inputs 类名输入(字符串、falsy 值、嵌套对象/数组均可)
 * @returns 合并去重后的单个 className 字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
