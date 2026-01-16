"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  /** When true, card acts as a navigation element */
  isActive?: boolean;
  /** Click handler for navigation mode */
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
  isActive,
  onClick,
}: KpiCardProps) {
  const isNavigable = onClick !== undefined;

  return (
    <div
      role={isNavigable ? "button" : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isNavigable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      } : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all",
        // Default border
        !isActive && "border-border/50",
        // Hover state for navigable cards
        isNavigable && "cursor-pointer hover:shadow-md hover:border-primary/50",
        // Active state
        isActive && "ring-2 ring-primary border-primary bg-primary/5",
        // Focus state for keyboard navigation
        isNavigable && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            isActive ? "text-primary" : "text-muted-foreground"
          )}>
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.value >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          isActive ? "bg-primary/20" : "bg-primary/10"
        )}>
          <Icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

interface KpiStripProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiStrip({ children, className }: KpiStripProps) {
  return (
    <nav
      className={cn(
        // Responsive grid: 1 col → 2 cols → 3 cols → 6 cols (all in one row on desktop)
        "grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
        className
      )}
      aria-label="Project sections"
    >
      {children}
    </nav>
  );
}
