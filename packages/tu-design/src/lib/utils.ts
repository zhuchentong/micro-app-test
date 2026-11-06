import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名：clsx 组合条件类名，tailwind-merge 消解冲突规则。
 * @param inputs - 任意数量的类名值（字符串、数组或对象）
 * @returns 消解冲突后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
