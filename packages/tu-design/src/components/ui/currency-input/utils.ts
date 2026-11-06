/** 货币单位：万/元/角/分（组件枚举固定，换算基准为整数分） */
export type CurrencyUnit = "万" | "元" | "角" | "分";

/** 各单位折合整数分：分=1、角=10、元=100、万=1000000 */
const UNIT_FEN_EXP: Record<CurrencyUnit, number> = { 万: 6, 元: 2, 角: 1, 分: 0 };

/**
 * 解析输入文本为 valueUnit 单位的数值（number|null）。
 * 全程十进制字符串移位（BigInt），仅在超出整数分精度时一次四舍五入；
 * 白名单 ^\d*(\.\d*)?$，负号/非法字符/无数字一律 null。
 * @param raw - 用户键入的数字文本（labelUnit 单位）
 * @param labelUnit - 输入文本的货币单位
 * @param valueUnit - 输出数值的目标货币单位
 * @returns valueUnit 单位的数值；格式非法或不含数字时返回 null
 */
export function parseCurrency(
  raw: string,
  labelUnit: CurrencyUnit,
  valueUnit: CurrencyUnit,
): number | null {
  if (!/^\d*(\.\d*)?$/.test(raw) || !/\d/.test(raw)) return null;
  const [intPart, fracPart = ""] = raw.split(".");
  const digits = BigInt((intPart || "0") + fracPart);
  const shift = UNIT_FEN_EXP[labelUnit] - fracPart.length;
  let fen: bigint;
  if (shift >= 0) {
    fen = digits * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const q = digits / divisor;
    const r = digits % divisor;
    fen = r * 2n >= divisor ? q + 1n : q;
  }
  return Number(fen) / 10 ** UNIT_FEN_EXP[valueUnit];
}

/**
 * 受控值（valueUnit 单位）反算为 labelUnit 单位的回显文本。
 * 值先取整到整数分（吸收浮点噪声），再做十进制移位并去尾零。
 * @param value - 受控值（valueUnit 单位）
 * @param valueUnit - 受控值的货币单位
 * @param labelUnit - 回显文本的目标货币单位
 * @returns labelUnit 单位的回显文本（已去尾零）；非有限值返回空串
 */
export function formatCurrency(
  value: number,
  valueUnit: CurrencyUnit,
  labelUnit: CurrencyUnit,
): string {
  if (!Number.isFinite(value)) return "";
  const negative = value < 0;
  const fen = BigInt(Math.abs(Math.round(value * 10 ** UNIT_FEN_EXP[valueUnit])));
  const exp = UNIT_FEN_EXP[labelUnit];
  let text: string;
  if (exp === 0) {
    text = fen.toString();
  } else {
    const s = fen.toString().padStart(exp + 1, "0");
    const frac = s.slice(-exp).replace(/0+$/, "");
    text = frac ? `${s.slice(0, -exp)}.${frac}` : s.slice(0, -exp);
  }
  return negative ? `-${text}` : text;
}
