import { cva, type VariantProps } from "class-variance-authority";

export { default as Card } from "./Card.vue";

export const cardVariants = cva(
  "relative rounded-xl border border-border bg-card text-card-foreground shadow-xs",
  {
    variants: {
      size: {
        sm: "rounded-lg text-sm [&>[data-slot=card-header]]:p-4 [&>[data-slot=card-content]]:px-4 [&>[data-slot=card-footer]]:px-4",
        default: "",
        lg: "rounded-2xl text-base [&>[data-slot=card-header]]:p-8 [&>[data-slot=card-content]]:px-8 [&>[data-slot=card-footer]]:px-8",
      },
      bordered: { true: "", false: "border-0 shadow-none" },
      hoverable: { true: "transition-shadow hover:shadow-md" },
      interactive: {
        true: "cursor-pointer transition-[box-shadow,translate] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
      },
      embedded: { true: "bg-muted/30" },
    },
    defaultVariants: {
      size: "default",
      bordered: true,
    },
  },
);

export type CardVariants = VariantProps<typeof cardVariants>;
