"use client";

import { cn } from "@/lib/utils";

interface StepProgressProps {
  current: number;
  total: number;
  label: string;
  sublabel?: string;
  showPercentage?: boolean;
}

/**
 * Discrete step-based progress indicator.
 * Uses individual step segments instead of a continuous progress bar
 * to clearly show discrete progress through a multi-step process.
 */
export function StepProgress({
  current,
  total,
  label,
  sublabel,
  showPercentage = false,
}: StepProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const clampedCurrent = Math.min(Math.max(0, current), total);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {clampedCurrent} / {total}
          {showPercentage && ` (${percentage}%)`}
        </span>
      </div>

      {/* Discrete step indicators */}
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={clampedCurrent}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label}: ${clampedCurrent} of ${total} complete`}
      >
        {total <= 20 ? (
          // Show individual steps for small totals
          Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 flex-1 rounded-sm transition-colors duration-300",
                i < clampedCurrent ? "bg-primary" : "bg-muted"
              )}
            />
          ))
        ) : (
          // Use continuous bar for large totals
          <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>

      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

interface CompactStepProgressProps {
  current: number;
  total: number;
  label: string;
}

/**
 * Compact inline step progress for use in tight spaces like table rows.
 */
export function CompactStepProgress({
  current,
  total,
  label,
}: CompactStepProgressProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium tabular-nums">
        {current}/{total}
      </span>
      <div className="flex gap-0.5">
        {total <= 10 ? (
          Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i < current ? "bg-primary" : "bg-muted"
              )}
            />
          ))
        ) : (
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(current / total) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
