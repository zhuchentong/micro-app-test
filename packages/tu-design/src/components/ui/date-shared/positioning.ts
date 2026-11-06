import type { PositioningOptions } from "@zag-js/popper";

/**
 * Ark DatePicker Root 的 positioning 配置类型。
 *
 * 直接引用 @zag-js/popper 的命名导出（而非经 @ark-ui/vue indexed-access
 * `Props["positioning"]` 取类型）：dts 生成（rolldown-plugin-dts / vue-tsc）
 * 展开匿名结构时链尾会引用 .pnpm 深路径的传递依赖类型，触发 TS2742
 * （inferred type cannot be named ... likely not portable）导致 prepack 构建
 * 失败。命名导入让声明输出直接写 `import("@zag-js/popper")` 逻辑名引用，
 * packages/vue 已显式声明该依赖（catalog:），构建可移植。
 */
export type PickerPositioning = PositioningOptions;
