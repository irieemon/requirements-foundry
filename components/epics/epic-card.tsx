"use client";

import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EpicCardProps {
  epic: {
    id: string;
    code: string;
    title: string;
    theme: string | null;
    description: string | null;
    effort: string | null;
    impact: string | null;
    priority: number | null;
    _count: {
      stories: number;
    };
  };
  className?: string;
}

function getImpactStyles(impact: string | null): string {
  switch (impact?.toLowerCase()) {
    case "high":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "medium":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "low":
      return "text-slate-600 bg-slate-100 border-slate-200";
    default:
      return "";
  }
}

function getEffortLabel(effort: string | null): string | null {
  switch (effort?.toUpperCase()) {
    case "S":
      return "Small";
    case "M":
      return "Medium";
    case "L":
      return "Large";
    default:
      return effort;
  }
}

export function EpicCard({ epic, className }: EpicCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-lg border border-border/40 bg-card p-4",
        "hover:border-border hover:shadow-sm transition-all duration-150",
        "cursor-pointer group",
        className
      )}
    >
      {/* Header: Code badge + Story count */}
      <div className="flex items-center justify-between mb-3">
        <Badge variant="outline" className="text-xs font-mono">
          {epic.code}
        </Badge>
        <Badge variant="default" className="text-xs">
          <BookOpen className="mr-1 h-3 w-3" />
          {epic._count.stories}
        </Badge>
      </div>

      {/* Title - primary element */}
      <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1">
        {epic.title}
      </h3>

      {/* Theme - subtle subtitle */}
      {epic.theme && (
        <p className="text-xs text-muted-foreground/80 mb-2">{epic.theme}</p>
      )}

      {/* Description - de-emphasized */}
      {epic.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-grow">
          {epic.description}
        </p>
      )}

      {/* Spacer to push footer down */}
      {!epic.description && <div className="flex-grow" />}

      {/* Footer: Impact & Effort badges */}
      <div className="flex flex-wrap gap-2 mt-auto pt-2">
        {epic.impact && (
          <Badge
            variant="outline"
            className={cn("text-xs", getImpactStyles(epic.impact))}
          >
            {epic.impact} impact
          </Badge>
        )}
        {epic.effort && (
          <Badge variant="secondary" className="text-xs">
            {getEffortLabel(epic.effort)}
          </Badge>
        )}
      </div>
    </div>
  );
}
