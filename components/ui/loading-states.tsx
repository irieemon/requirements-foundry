import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// KPI Card Skeleton
// ============================================

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card p-5",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
    </div>
  );
}

export function KpiStripSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
    </div>
  );
}

// ============================================
// Table Row Skeleton
// ============================================

export function TableRowSkeleton({
  columns = 5,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 py-3 px-4 border-b border-border/50",
        className
      )}
    >
      {/* Icon + text first column */}
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Other columns */}
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-16" />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center gap-4 py-3 px-4 border-b border-border bg-muted/30">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i === 0 ? "w-24 flex-1" : "w-16")} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

// ============================================
// Card Skeleton
// ============================================

export function CardSkeleton({
  className,
  withHeader = true,
}: {
  className?: string;
  withHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card shadow-sm",
        className
      )}
    >
      {withHeader && (
        <div className="p-6 pb-4 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}
      <div className="p-6 pt-0 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

// ============================================
// Page Header Skeleton
// ============================================

export function PageHeaderSkeleton() {
  return (
    <div className="bg-background/95 border-b border-border/50 sticky top-0 z-30">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Progress Panel Skeleton
// ============================================

export function RunProgressSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Timeline steps */}
        <div className="flex items-start justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Skeleton className="h-7 w-7 rounded-full" />
                {i < 4 && <Skeleton className="w-0.5 h-6 mt-1" />}
              </div>
              <Skeleton className="h-4 w-16 mt-1" />
            </div>
          ))}
        </div>
        {/* Progress */}
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        {/* Document list */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tabs Skeleton
// ============================================

export function TabsSkeleton({
  tabs = 4,
  className,
}: {
  tabs?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex gap-2 p-1 bg-card border border-border/50 rounded-lg w-fit">
        {Array.from({ length: tabs }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <CardSkeleton />
    </div>
  );
}
