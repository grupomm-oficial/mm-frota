import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-wait aria-busy:opacity-90 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-[0_10px_22px_rgba(250,204,21,0.16)]",
  {
    variants: {
      variant: {
        default:
          "border border-yellow-400/30 bg-yellow-400 text-slate-950 hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-[0_14px_30px_rgba(250,204,21,0.24)]",
        destructive:
          "border border-red-300/20 bg-destructive text-white hover:-translate-y-0.5 hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border bg-white text-slate-700 shadow-none hover:-translate-y-0.5 hover:border-yellow-400/45 hover:bg-yellow-50 hover:text-yellow-700 dark:bg-input/30 dark:text-slate-100 dark:hover:border-yellow-400/30 dark:hover:bg-yellow-400/10 dark:hover:text-yellow-200",
        secondary:
          "border border-yellow-400/30 bg-yellow-100 text-yellow-900 hover:-translate-y-0.5 hover:bg-yellow-200 dark:bg-yellow-400/12 dark:text-yellow-100 dark:hover:bg-yellow-400/18",
        ghost:
          "hover:bg-accent hover:text-accent-foreground shadow-none dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-2xl px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
