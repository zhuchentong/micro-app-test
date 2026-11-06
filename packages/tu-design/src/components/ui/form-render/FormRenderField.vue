<script lang="ts">
import type { PropType } from "vue";
import { defineComponent, h } from "vue";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../components/ui/form";
import type { FormRenderItem, WidgetRenderReturn } from "./types";

/**
 * 单字段桥接：复用 <FormField>（form.Field 动态渲染 + FIELD_KEY provide 时序），
 * 内部组装 FormItem/FormLabel/FormControl/FormDescription/FormMessage，
 * aria 接线（id/aria-invalid/aria-describedby）由 FormControl 的 cloneVNode 机制继承。
 * widget 调用发生在 FormField 插槽期，拿到 field 实例后组装 WidgetContext。
 */
export default defineComponent({
  name: "TuFormRenderField",
  props: {
    item: { type: Object as PropType<FormRenderItem<any>>, required: true },
    /** 已柯里化的 widget 渲染函数：r.input({...}) 的返回值 */
    widget: { type: Function as PropType<WidgetRenderReturn<any>>, required: true },
    /** 响应式全量表单值（FormRender 经 useSelector 建立，S1） */
    values: { type: Object as PropType<Record<string, unknown>>, required: true },
  },
  setup(props) {
    return () =>
      h(
        FormField,
        {
          name: String(props.item.key),
          validators: props.item.validators,
        },
        {
          default: ({ field }: any) => {
            if (!field) {
              if (import.meta.env.DEV) {
                console.warn(
                  "[tu-design] <FormRenderField> 未取得 field 上下文（FormRender 缺 definition/form？）",
                );
              }
              return null;
            }
            return h(
              FormItem,
              { class: props.item.class },
              {
                default: () => [
                  props.item.hideLabel ? null : h(FormLabel, () => props.item.title),
                  h(FormControl, () =>
                    props.widget({
                      field,
                      item: props.item,
                      values: props.values as never,
                    }),
                  ),
                  props.item.description ? h(FormDescription, () => props.item.description) : null,
                  h(FormMessage),
                ],
              },
            );
          },
        },
      );
  },
});
</script>
