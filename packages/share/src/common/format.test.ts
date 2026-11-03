import { describe, expect, it } from "vite-plus/test";
import { formatClockTime, formatDuration } from "@repo/share";

describe("formatDuration", () => {
  it("小于 60 秒只显示秒", () => {
    expect(formatDuration(45)).toBe("45 秒");
  });
  it("超过 60 秒显示分与补零秒", () => {
    expect(formatDuration(65)).toBe("1 分 05 秒");
    expect(formatDuration(130)).toBe("2 分 10 秒");
  });
  it("负数按 0 处理", () => {
    expect(formatDuration(-3)).toBe("0 秒");
  });
});

describe("formatClockTime", () => {
  it("输出 HH:MM:SS", () => {
    const d = new Date(2026, 10, 2, 9, 5, 3);
    expect(formatClockTime(d)).toBe("09:05:03");
  });
});
