import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botón de campo: alto mínimo 48 px, texto de 16 px. Se usa con guantes, con
 * sol y con una sola mano.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground active:bg-primary/85",
        secondary: "bg-secondary text-secondary-foreground active:bg-secondary/70",
        outline: "border border-border bg-card text-foreground active:bg-muted",
        ghost: "text-muted-foreground active:bg-muted",
        danger: "bg-destructive text-white active:bg-destructive/85",
      },
      size: {
        md: "h-12 px-4",
        lg: "h-14 px-5 text-[17px]",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
