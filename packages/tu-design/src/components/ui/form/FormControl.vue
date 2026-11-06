<script lang="ts">
import { cloneVNode, computed, defineComponent, inject } from "vue";
import { FIELD_KEY, FORM_ITEM_KEY } from "./context";

/**
 * 把 id / aria-invalid / aria-describedby 合并到唯一子元素（cloneVNode）。
 * aria 全同步计算：description/message 的 presence 由 FormItem 的 refs 提供。
 */
export default defineComponent({
  name: "TuFormControl",
  props: {
    class: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const fieldCtx = inject(FIELD_KEY, undefined);
    const itemCtx = inject(FORM_ITEM_KEY, undefined);

    if (import.meta.env.DEV && (!fieldCtx || !itemCtx)) {
      console.warn("[tu-design] <FormControl> 必须在 <FormField> + <FormItem> 内使用");
    }

    const isInvalid = computed(() => itemCtx?.isInvalid.value ?? false);
    const describedBy = computed(() => {
      if (!itemCtx) return undefined;
      const ids = [
        itemCtx.hasDescription.value && itemCtx.descriptionId,
        itemCtx.hasMessage.value && itemCtx.isInvalid.value && itemCtx.messageId,
      ].filter(Boolean);
      return ids.length > 0 ? ids.join(" ") : undefined;
    });

    return () => {
      const vnodes = slots.default?.() ?? [];
      if (import.meta.env.DEV && vnodes.length !== 1) {
        console.warn("[tu-design] <FormControl> 需要且仅需要一个子元素");
      }
      const first = vnodes[0];
      if (!first) return null;
      return cloneVNode(first, {
        id: itemCtx?.controlId,
        "aria-invalid": isInvalid.value || undefined,
        "aria-describedby": describedBy.value,
        class: props.class,
      });
    };
  },
});
</script>
