"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, FileText, Clock, Zap, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressCountsProps {
  uploadsProcessed: number;
  totalUploads: number;
  cardsExtracted: number;
  chunksProcessed?: number;
  totalChunks?: number;
  elapsedMs: number;
  tokensUsed?: number;
  className?: string;
}

/**
 * Grid display of key progress metrics during a run.
 * Shows uploads, cards, time, and token usage.
 */
export function ProgressCounts({
  uploadsProcessed,
  totalUploads,
  cardsExtracted,
  chunksProcessed,
  totalChunks,
  elapsedMs,
  tokensUsed,
  className,
}: ProgressCountsProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <CountCard
        icon={<FileText className="h-4 w-4" />}
        label="Uploads"
        value={`${uploadsProcessed}/${totalUploads}`}
        description="files analyzed"
        isComplete={uploadsProcessed === totalUploads && totalUploads > 0}
      />
      <CountCard
        icon={<Layers className="h-4 w-4" />}
        label="Cards"
        value={cardsExtracted.toString()}
        description="extracted"
        highlight={cardsExtracted > 0}
      />
      {chunksProcessed !== undefined && totalChunks !== undefined && (
        <CountCard
          icon={<Hash className="h-4 w-4" />}
          label="Chunks"
          value={`${chunksProcessed}/${totalChunks}`}
          description="processed"
          isComplete={chunksProcessed === totalChunks && totalChunks > 0}
        />
      )}
      <CountCard
        icon={<Clock className="h-4 w-4" />}
        label="Elapsed"
        value={formatTime(elapsedMs)}
        description="running time"
      />
      {tokensUsed !== undefined && (
        <CountCard
          icon={<Zap className="h-4 w-4" />}
          label="Tokens"
          value={tokensUsed.toLocaleString()}
          description="AI tokens used"
        />
      )}
    </div>
  );
}

interface CountCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  isComplete?: boolean;
  highlight?: boolean;
}

function CountCard({
  icon,
  label,
  value,
  description,
  isComplete,
  highlight,
}: CountCardProps) {
  return (
    <Card
      className={cn(
        "transition-colors",
        isComplete && "border-green-500/50 bg-green-500/5",
        highlight && "border-primary/50 bg-primary/5"
      )}
    >
      <CardContent className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "mt-0.5",
            isComplete
              ? "text-green-600"
              : highlight
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums truncate",
              isComplete && "text-green-600",
              highlight && "text-primary"
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface CompactCountsProps {
  uploadsProcessed: number;
  totalUploads: number;
  cardsExtracted: number;
  elapsedMs: number;
}

/**
 * Compact inline counts for use in headers or tight spaces.
 */
export function CompactCounts({
  uploadsProcessed,
  totalUploads,
  cardsExtracted,
  elapsedMs,
}: CompactCountsProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums font-medium">
          {uploadsProcessed}/{totalUploads}
        </span>
        <span className="text-muted-foreground">uploads</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums font-medium">{cardsExtracted}</span>
        <span className="text-muted-foreground">cards</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums font-mono">{formatTime(elapsedMs)}</span>
      </div>
    </div>
  );
}
