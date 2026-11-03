import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../jsdoc-plugin.js";

const rule = plugin.rules["require-jsdoc"];

const tester = new RuleTester();

describe("@repo/config-lint/require-jsdoc", () => {
  it("导出函数与模块级私有函数必须有 JSDoc", () => {
    tester.run("require-jsdoc", rule, {
      valid: [
        // 导出函数声明 + JSDoc
        "/** 两数之和 */\nexport function add(a, b) { return a + b; }",
        // 模块级私有函数 + JSDoc
        "/** 工具函数 */\nfunction helper() { return 1; }",
        // 导出 const 箭头函数 + JSDoc
        "/** 加一 */\nexport const inc = (x) => x + 1;",
        // 私有 const async 函数表达式 + JSDoc
        "/** 异步任务 */\nconst task = async function run() {};",
        // JSDoc 与函数之间隔空行仍算紧跟
        "/** 描述 */\n\nexport function spaced() {}",
        // 类方法不在范围内
        "class A { run() {} }",
        // 嵌套函数不在范围内(外层已有 JSDoc)
        "/** 外层 */\nfunction outer() { function inner() {} return inner; }",
        // 普通对象属性方法不在范围内
        "const obj = { /** 方法 */ run() {} };",
        // 非函数 const 不报
        "const limit = 8;",
        // let/var 函数表达式不报(非常量绑定不视为稳定模块 API)
        "let later = () => {};",
        // 空注释块的普通 /* */ 不算 JSDoc → 但函数本身带 /* */ 也应报(见 invalid)
      ],
      invalid: [
        {
          code: "export function add(a, b) { return a + b; }",
          errors: [{ messageId: "missing", data: { name: "add" } }],
        },
        {
          // 模块级私有函数缺失
          code: "function helper() { return 1; }",
          errors: [{ messageId: "missing", data: { name: "helper" } }],
        },
        {
          // 导出 const 箭头函数缺失
          code: "export const inc = (x) => x + 1;",
          errors: [{ messageId: "missing", data: { name: "inc" } }],
        },
        {
          // 私有 const 函数表达式缺失
          code: "const task = async function run() {};",
          errors: [{ messageId: "missing", data: { name: "task" } }],
        },
        {
          // 普通 /* */ 块注释不算 JSDoc
          code: "/* 两数之和 */\nexport function add(a, b) { return a + b; }",
          errors: [{ messageId: "missing", data: { name: "add" } }],
        },
        {
          // 行注释不算 JSDoc
          code: "// 两数之和\nexport function add(a, b) { return a + b; }",
          errors: [{ messageId: "missing", data: { name: "add" } }],
        },
        {
          // 匿名 default 导出也要求 JSDoc
          code: "export default function () { return 1; }",
          errors: [{ messageId: "missing", data: { name: "default" } }],
        },
        {
          // 同文件前一个函数的 JSDoc 不能"借用"给后一个
          code: "/** 有注释的 */\nfunction good() {}\nfunction bad() {}",
          errors: [{ messageId: "missing", data: { name: "bad" } }],
        },
      ],
    });
  });
});
