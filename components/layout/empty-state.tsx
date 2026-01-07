import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      <div
        className={cn(
          "rounded-xl bg-muted/50 border border-border/50 mb-4 flex items-center justify-center",
          compact ? "h-12 w-12" : "h-16 w-16"
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            compact ? "h-6 w-6" : "h-8 w-8"
          )}
          aria-hidden="true"
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-base mb-1" : "text-lg mb-2"
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-muted-foreground max-w-sm",
          compact ? "text-sm mb-3" : "text-sm mb-5"
        )}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
