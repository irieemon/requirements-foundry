"use client";

import { Card } from "@/components/ui/card";
import { BookOpen, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MssCoverageStats } from "@/lib/mss/types";

interface CoverageItemProps {
  label: string;
  value: number;
  total?: number;
  percentage?: number;
  icon: React.ElementType;
  showPercentage?: boolean;
}

function getCoverageColor(percent: number): string {
  if (percent >= 80) return "text-green-600 dark:text-green-400";
  if (percent >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getCoverageBgColor(percent: number): string {
  if (percent >= 80) return "bg-green-100 dark:bg-green-900/30";
  if (percent >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function CoverageItem({
  label,
  value,
  total,
  percentage,
  icon: Icon,
  showPercentage,
}: CoverageItemProps) {
  const hasPercentage = showPercentage && percentage !== undefined;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          hasPercentage
            ? getCoverageBgColor(percentage)
            : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            hasPercentage
              ? getCoverageColor(percentage)
              : "text-primary"
          )}
        />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {total !== undefined && (
            <p className="text-sm text-muted-foreground">/ {total}</p>
          )}
          {hasPercentage && (
            <p
              className={cn(
                "ml-2 text-sm font-semibold",
                getCoverageColor(percentage)
              )}
            >
              ({percentage}%)
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface MssCoverageCardProps {
  stats: MssCoverageStats;
  className?: string;
}

export function MssCoverageCard({ stats, className }: MssCoverageCardProps) {
  if (stats.totalEpics === 0 && stats.totalStories === 0) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">No epics or stories to analyze</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-8">
        <CoverageItem
          label="Epics with MSS"
          value={stats.assignedEpics}
          total={stats.totalEpics}
          percentage={stats.epicCoveragePercent}
          icon={BookOpen}
          showPercentage
        />
        <CoverageItem
          label="Epics without MSS"
          value={stats.unassignedEpics}
          icon={BookOpen}
        />
        <CoverageItem
          label="Stories with MSS"
          value={stats.assignedStories}
          total={stats.totalStories}
          percentage={stats.storyCoveragePercent}
          icon={FileText}
          showPercentage
        />
        <CoverageItem
          label="Stories without MSS"
          value={stats.unassignedStories}
          icon={FileText}
        />
      </div>
    </Card>
  );
}
