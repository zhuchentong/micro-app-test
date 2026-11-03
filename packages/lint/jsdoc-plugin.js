import { definePlugin, defineRule } from "vite-plus/lint/plugins";

/**
 * 判断注释是否为 JSDoc 块（`/**` 开头的块注释）。
 *
 * @param {object} comment oxlint 注释节点（含 `type` 与 `value`）
 * @returns {boolean} 是 JSDoc 块返回 `true`
 */
function isJsdoc(comment) {
  return comment.type === "Block" && comment.value.startsWith("*");
}

/**
 * require-jsdoc 规则：强制「导出函数」与「模块级私有函数」必须携带 JSDoc 注释块。
 *
 * 覆盖范围（均为模块顶层）：
 * - `function` 声明（含 `export function`、async、generator）
 * - `export const` / `const` 绑定的箭头函数与函数表达式
 * - `export default function`（匿名时以 `default` 命名报出）
 *
 * 豁免（由规则内部判定）：
 * - `declare function` 与 TS 重载签名（无函数体）
 * - 类方法、对象方法、嵌套函数（组件/回调场景噪音大，不在本规则范围内）
 * - 文件级豁免（测试、`.vue`、本包自身）由 `config.ts` 的 `jsdocExemptOverrides` 以
 *   overrides 关闭，规则内不做路径判断
 *
 * 判定方式：函数 `range[0]` 之前最近的一条注释若是 JSDoc 块即视为已注释；
 * 若中间隔着普通块/行注释则视为缺失。
 */
const requireJsdoc = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "要求导出函数与模块级私有函数必须有 JSDoc 注释块" },
    messages: {
      missing: "函数 `{{name}}` 缺少 JSDoc 注释块（/** … */，含功能描述与 @param/@returns）",
    },
    schema: [],
  },
  create(context) {
    /**
     * 检查单个函数节点：前方无 JSDoc 块则报错。
     *
     * 用 `sourceCode.getCommentsBefore(anchor)` 取紧邻语句的注释：锚点必须是
     * **整条语句**而非函数节点——`export function` 的紧邻 token 是 `export`
     * 关键字，JSDoc 位于其之前，锚定函数节点会漏检。getCommentsBefore 的
     * "紧邻"语义同时保证前一函数的 JSDoc 不会被借用给后续无注释函数。
     *
     * @param {{body: unknown} | null} fn 函数 AST 节点
     * @param {string | undefined} name 函数名（匿名调用方传入 `default`）
     * @param {object} anchor 语句级锚点节点（ExportNamedDeclaration 等）
     */
    const checkFn = (fn, name, anchor) => {
      if (!fn || !fn.body || !name) return;
      const before = context.sourceCode.getCommentsBefore(anchor);
      const last = before[before.length - 1];
      if (last && isJsdoc(last)) return;
      context.report({ node: fn, messageId: "missing", data: { name } });
    };

    /**
     * 检查顶层 `const` 声明：init 为箭头函数/函数表达式时视为模块级私有函数。
     *
     * @param {{kind: string, declarations: Array<object>}} decl 变量声明节点
     * @param {object} anchor 语句级锚点节点
     */
    const checkVariableDeclaration = (decl, anchor) => {
      if (decl.kind !== "const") return;
      for (const d of decl.declarations) {
        const init = d.init;
        if (
          init &&
          (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
        ) {
          checkFn(init, d.id && d.id.name, anchor);
        }
      }
    };

    return {
      /**
       * Program 入口：逐条检查模块顶层语句。
       *
       * @param {{body: Array<object>}} program 程序节点
       */
      Program(program) {
        for (const stmt of program.body) {
          if (stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") {
            const d = stmt.declaration;
            if (!d) continue;
            if (d.type === "FunctionDeclaration") {
              checkFn(d, d.id ? d.id.name : "default", stmt);
            } else if (d.type === "VariableDeclaration") {
              checkVariableDeclaration(d, stmt);
            }
            continue;
          }
          if (stmt.type === "FunctionDeclaration") {
            checkFn(stmt, stmt.id && stmt.id.name, stmt);
          } else if (stmt.type === "VariableDeclaration") {
            checkVariableDeclaration(stmt, stmt);
          }
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "repo-lint" },
  rules: { "require-jsdoc": requireJsdoc },
});
