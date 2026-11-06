<script lang="ts">
import type { AnyFieldApi } from "@tanstack/vue-form";
import type { PropType } from "vue";
import { defineComponent, h, inject, provide, shallowRef } from "vue";
import { FIELD_KEY, FORM_KEY } from "./context";

/**
 * 渲染 TanStack `form.Field` 并经 provide 下发 field 上下文。
 * field 实例只能在 form.Field 的插槽执行期取得（时序早于子组件 setup），
 * 故用 defineComponent + render function 在插槽回调中写入 ShallowRef。
 */
export default defineComponent({
  name: "TuFormField",
  props: {
    /** 字段名（TanStack 深层 key 的运行时形态） */
    name: { type: String, required: true },
    /** 校验器配置，原样透传（值可为函数或 Standard Schema，如 valibot） */
    validators: { type: Object as PropType<Record<string, unknown>>, default: undefined },
    /** 字段模式：value 单值（默认）；array 数组字段，解锁 pushValue/removeValue 等行操作 */
    mode: { type: String as PropType<"value" | "array">, default: "value" },
  },
  setup(props, { slots }) {
    const form = inject(FORM_KEY);
    if (!form && import.meta.env.DEV) {
      console.warn("[tu-design] <FormField> 必须在 <Form> 内使用");
    }

    const fieldRef = shallowRef<AnyFieldApi>();
    provide(FIELD_KEY, { field: fieldRef, name: props.name });

    if (!form) {
      // 优雅降级：field 上下文缺席（FIELD_KEY.field 为 undefined），子组件需自行容忍
      return () => slots.default?.({ field: undefined as unknown as AnyFieldApi });
    }

    return () =>
      h(
        form.Field as never,
        { name: props.name, validators: props.validators, mode: props.mode } as never,
        {
          default: (slotProps: { field: AnyFieldApi }) => {
            fieldRef.value = slotProps.field;
            return slots.default?.(slotProps);
          },
        },
      );
  },
});
</script>
