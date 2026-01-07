"use client";

import { useEffect, useState } from "react";
import { Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface DurationDisplayProps {
  startedAt: Date;
  completedAt?: Date | null;
  showEstimate?: boolean;
  estimatedTotalMs?: number;
  className?: string;
}

/**
 * Live elapsed time display with optional remaining time estimate.
 * Updates every second while the run is active.
 */
export function DurationDisplay({
  startedAt,
  completedAt,
  showEstimate = false,
  estimatedTotalMs,
  className,
}: DurationDisplayProps) {
  const [elapsed, setElapsed] = useState(() =>
    completedAt
      ? completedAt.getTime() - startedAt.getTime()
      : Date.now() - startedAt.getTime()
  );

  useEffect(() => {
    // If completed, just set the final elapsed time
    if (completedAt) {
      setElapsed(completedAt.getTime() - startedAt.getTime());
      return;
    }

    // Update elapsed time every second
    const tick = () => {
      setElapsed(Date.now() - startedAt.getTime());
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const remaining =
    showEstimate && estimatedTotalMs && !completedAt
      ? Math.max(0, estimatedTotalMs - elapsed)
      : null;

  const isOverEstimate =
    estimatedTotalMs && !completedAt && elapsed > estimatedTotalMs;

  return (
    <div
      className={cn("flex items-center gap-4 text-sm", className)}
      role="timer"
      aria-label={`Elapsed time: ${formatDuration(elapsed)}`}
    >
      <div className="flex items-center gap-1.5">
        <Clock
          className={cn(
            "h-4 w-4",
            completedAt ? "text-green-600" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "font-mono tabular-nums",
            !completedAt && "motion-safe:animate-pulse"
          )}
        >
          {formatDuration(elapsed)}
        </span>
        <span className="text-muted-foreground">elapsed</span>
      </div>

      {remaining !== null && remaining > 0 && (
        <div
          className={cn(
            "flex items-center gap-1.5",
            isOverEstimate && "text-amber-600"
          )}
        >
          <Timer className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums">~{formatDuration(remaining)}</span>
          <span className="text-muted-foreground">remaining</span>
        </div>
      )}

      {isOverEstimate && (
        <span className="text-xs text-amber-600">(taking longer than expected)</span>
      )}
    </div>
  );
}

interface CompactDurationProps {
  startedAt: Date;
  completedAt?: Date | null;
}

/**
 * Minimal duration display for inline use.
 */
export function CompactDuration({ startedAt, completedAt }: CompactDurationProps) {
  const [elapsed, setElapsed] = useState(() =>
    completedAt
      ? completedAt.getTime() - startedAt.getTime()
      : Date.now() - startedAt.getTime()
  );

  useEffect(() => {
    if (completedAt) {
      setElapsed(completedAt.getTime() - startedAt.getTime());
      return;
    }

    const tick = () => setElapsed(Date.now() - startedAt.getTime());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <span className="font-mono tabular-nums text-sm">
      {minutes}:{remainingSeconds.toString().padStart(2, "0")}
    </span>
  );
}
