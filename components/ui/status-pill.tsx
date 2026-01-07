import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground ring-border",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning-foreground ring-warning/20",
        destructive: "bg-destructive/10 text-destructive ring-destructive/20",
        info: "bg-primary/10 text-primary ring-primary/20",
        muted: "bg-muted text-muted-foreground ring-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  dot?: boolean;
  pulse?: boolean;
}

export function StatusPill({
  className,
  variant,
  dot = true,
  pulse = false,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(statusPillVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "destructive" && "bg-destructive",
            variant === "info" && "bg-primary",
            variant === "muted" && "bg-muted-foreground",
            (!variant || variant === "default") && "bg-secondary-foreground",
            pulse && "animate-pulse"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
