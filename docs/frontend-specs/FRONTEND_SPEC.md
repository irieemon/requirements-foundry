# Frontend Specification: Requirements Foundry Refinement

## Overview

This document provides comprehensive frontend specifications for transitioning from immediate upload-triggered card generation to an explicit "Analyze Project" workflow with rich progress visualization.

---

## A) "ANALYZE PROJECT" TRIGGER UI

### A.1 Button Placement Strategy

**Recommended: Project Page Header (Right Side)**

```
+--------------------------------------------------------------+
| <- Back  Project Name                    [Export] [Analyze Project] |
|          Description text here...                            |
+--------------------------------------------------------------+
```

**Rationale:**
- Consistent with existing `ExportProjectButton` placement
- Always visible regardless of active tab
- Clear primary action hierarchy (Analyze is the main CTA)

**Alternative: Floating Action Button (FAB)**
- Use only if the header becomes crowded
- Position: bottom-right, fixed
- Less discoverable for first-time users

### A.2 Component: `AnalyzeProjectButton`

```tsx
// components/analysis/analyze-project-button.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter,
         DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

interface Upload {
  id: string;
  filename: string | null;
  fileType: string;
  status: string;
  wordCount: number | null;
}

interface AnalyzeProjectButtonProps {
  projectId: string;
  uploads: Upload[];
  hasActiveRun: boolean;
  existingCardCount: number;
}

export function AnalyzeProjectButton({
  projectId,
  uploads,
  hasActiveRun,
  existingCardCount,
}: AnalyzeProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(
    new Set(uploads.filter(u => u.status === "COMPLETED").map(u => u.id))
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const completedUploads = uploads.filter(u => u.status === "COMPLETED");
  const pendingUploads = uploads.filter(u => u.status === "PENDING");
  const hasNoUploads = uploads.length === 0;
  const hasNothingToAnalyze = completedUploads.length === 0;

  // Disable conditions
  const isDisabled = hasNoUploads || hasActiveRun || isAnalyzing;

  const getButtonLabel = () => {
    if (isAnalyzing) return "Analyzing...";
    if (hasActiveRun) return "Analysis Running";
    if (existingCardCount > 0) return "Re-analyze Project";
    return "Analyze Project";
  };

  const handleToggleUpload = (uploadId: string) => {
    setSelectedUploads(prev => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // API call to start analysis run
    // Navigate to run detail page or show inline progress
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={isDisabled}
          variant={existingCardCount > 0 ? "outline" : "default"}
          aria-describedby="analyze-button-status"
        >
          {isAnalyzing || hasActiveRun ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {getButtonLabel()}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Analyze Project</DialogTitle>
          <DialogDescription>
            Select which uploads to analyze for use case extraction.
            {existingCardCount > 0 && (
              <span className="block mt-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                This will replace {existingCardCount} existing cards.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasNothingToAnalyze ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No completed uploads available for analysis.</p>
            {pendingUploads.length > 0 && (
              <p className="mt-2 text-sm">
                {pendingUploads.length} upload(s) still processing...
              </p>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[300px] pr-4">
            <div className="space-y-3" role="group" aria-label="Select uploads to analyze">
              {completedUploads.map((upload) => (
                <label
                  key={upload.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border
                             hover:bg-accent cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedUploads.has(upload.id)}
                    onCheckedChange={() => handleToggleUpload(upload.id)}
                    aria-label={`Select ${upload.filename || "Pasted text"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {upload.filename || "Pasted text"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {upload.fileType.split("/")[1] || upload.fileType}
                      </Badge>
                      {upload.wordCount && (
                        <span className="text-xs text-muted-foreground">
                          ~{upload.wordCount.toLocaleString()} words
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedUploads.size} of {completedUploads.length} selected
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={selectedUploads.size === 0 || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Analysis
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### A.3 Disabled States Matrix

| Condition | Button State | Visual Indicator |
|-----------|--------------|------------------|
| No uploads | Disabled | Tooltip: "Upload content first" |
| All uploads pending/failed | Disabled | Tooltip: "No completed uploads" |
| Run already active | Disabled + Spinner | "Analysis Running" label |
| Ready to analyze | Enabled | Primary button style |
| Has existing cards | Enabled (outline) | "Re-analyze Project" label |

---

## B) RUN TIMELINE COMPONENT

### B.1 Layout Architecture

```
+------------------------------------------------------------------+
| Run: Extract Cards                                    [Running]   |
| Started 2 minutes ago                                             |
+------------------------------------------------------------------+
|                                                                   |
|  TIMELINE                           |  DETAILS                    |
|  +---------------------------------+|  +------------------------+  |
|  | [*] Initializing       00:02   ||  | Current Phase          |  |
|  |     Run created, queuing...    ||  | Analyzing Upload 2/5   |  |
|  |                                ||  |                        |  |
|  | [*] Analyzing Uploads  01:45   ||  | Elapsed: 1m 45s        |  |
|  |     > doc1.pdf    [Done]       ||  |                        |  |
|  |     > notes.txt   [Running]    ||  | Tokens: 12,450         |  |
|  |     > spec.docx   [Pending]    ||  |                        |  |
|  |                                ||  +------------------------+  |
|  | [ ] Extracting Cards           ||                              |
|  |                                ||  +------------------------+  |
|  | [ ] Finalizing                 ||  | LOGS                   |  |
|  +---------------------------------+|  | > Processing doc1.pdf  |  |
|                                     |  | > Found 12 use cases   |  |
|                                     |  | > Chunking notes.txt   |  |
|                                     |  +------------------------+  |
+------------------------------------------------------------------+
```

### B.2 Phase Configuration

```tsx
// lib/run-phases.ts
export const RUN_PHASES = {
  EXTRACT_CARDS: [
    {
      id: "init",
      label: "Initializing",
      description: "Setting up analysis run"
    },
    {
      id: "analyze",
      label: "Analyzing Uploads",
      description: "Processing document content",
      hasUploadBreakdown: true
    },
    {
      id: "extract",
      label: "Extracting Cards",
      description: "Identifying use cases"
    },
    {
      id: "finalize",
      label: "Finalizing",
      description: "Saving results"
    },
  ],
  GENERATE_EPICS: [
    { id: "init", label: "Initializing", description: "Loading cards" },
    { id: "cluster", label: "Clustering Cards", description: "Grouping related cards" },
    { id: "generate", label: "Generating Epics", description: "Creating epic definitions" },
    { id: "finalize", label: "Finalizing", description: "Saving epics" },
  ],
  GENERATE_STORIES: [
    { id: "init", label: "Initializing", description: "Loading epic context" },
    { id: "generate", label: "Generating Stories", description: "Creating user stories" },
    { id: "subtasks", label: "Creating Subtasks", description: "Breaking down stories" },
    { id: "finalize", label: "Finalizing", description: "Saving stories" },
  ],
} as const;
```

### B.3 Component: `RunTimeline`

```tsx
// components/runs/run-timeline.tsx
"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, Circle, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { useState } from "react";

type PhaseStatus = "pending" | "running" | "completed" | "failed";

interface UploadProgress {
  uploadId: string;
  filename: string;
  status: PhaseStatus;
  chunksProcessed?: number;
  totalChunks?: number;
  cardsExtracted?: number;
}

interface Phase {
  id: string;
  label: string;
  description: string;
  status: PhaseStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  uploads?: UploadProgress[];
  logs?: string[];
}

interface RunTimelineProps {
  phases: Phase[];
  currentPhaseId: string | null;
}

export function RunTimeline({ phases, currentPhaseId }: RunTimelineProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set([currentPhaseId].filter(Boolean) as string[])
  );

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const getPhaseIcon = (status: PhaseStatus, isCurrent: boolean) => {
    if (status === "completed") {
      return <Check className="h-4 w-4 text-green-600" aria-hidden="true" />;
    }
    if (status === "failed") {
      return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
    }
    if (status === "running" || isCurrent) {
      return <Loader2 className="h-4 w-4 text-primary animate-spin" aria-hidden="true" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <nav
      className="space-y-1"
      aria-label="Analysis progress"
      role="list"
    >
      {phases.map((phase, index) => {
        const isCurrent = phase.id === currentPhaseId;
        const isExpanded = expandedPhases.has(phase.id);
        const hasDetails = phase.uploads?.length || phase.logs?.length;

        return (
          <div
            key={phase.id}
            role="listitem"
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "relative pl-8 pb-4",
              index < phases.length - 1 && "border-l-2 border-muted ml-2"
            )}
          >
            {/* Timeline node */}
            <div
              className={cn(
                "absolute left-0 top-0 flex h-6 w-6 items-center justify-center",
                "rounded-full border-2 bg-background",
                phase.status === "completed" && "border-green-600",
                phase.status === "failed" && "border-destructive",
                phase.status === "running" && "border-primary",
                phase.status === "pending" && "border-muted"
              )}
            >
              {getPhaseIcon(phase.status, isCurrent)}
            </div>

            {/* Phase content */}
            <Collapsible
              open={isExpanded}
              onOpenChange={() => hasDetails && togglePhase(phase.id)}
            >
              <div className="flex items-center justify-between">
                <CollapsibleTrigger
                  className={cn(
                    "flex items-center gap-2 text-left",
                    hasDetails && "cursor-pointer hover:text-foreground"
                  )}
                  disabled={!hasDetails}
                >
                  <span className={cn(
                    "font-medium",
                    phase.status === "pending" && "text-muted-foreground",
                    phase.status === "running" && "text-foreground",
                    phase.status === "completed" && "text-foreground",
                    phase.status === "failed" && "text-destructive"
                  )}>
                    {phase.label}
                  </span>
                  {hasDetails && (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  )}
                </CollapsibleTrigger>

                {phase.durationMs && (
                  <Badge variant="outline" className="text-xs">
                    {formatDuration(phase.durationMs)}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mt-0.5">
                {phase.description}
              </p>

              <CollapsibleContent className="mt-3 space-y-2">
                {/* Upload breakdown */}
                {phase.uploads && phase.uploads.length > 0 && (
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {phase.uploads.map((upload) => (
                      <UploadProgressRow key={upload.uploadId} upload={upload} />
                    ))}
                  </div>
                )}

                {/* Logs */}
                {phase.logs && phase.logs.length > 0 && (
                  <ScrollArea className="h-[100px] rounded border bg-muted/30 p-2">
                    <pre className="text-xs font-mono">
                      {phase.logs.join("\n")}
                    </pre>
                  </ScrollArea>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </nav>
  );
}

function UploadProgressRow({ upload }: { upload: UploadProgress }) {
  const getStatusIndicator = () => {
    switch (upload.status) {
      case "completed":
        return <Check className="h-3 w-3 text-green-600" />;
      case "running":
        return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Circle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2 min-w-0">
        {getStatusIndicator()}
        <span className="truncate">{upload.filename}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {upload.chunksProcessed !== undefined && upload.totalChunks !== undefined && (
          <span>chunk {upload.chunksProcessed}/{upload.totalChunks}</span>
        )}
        {upload.cardsExtracted !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {upload.cardsExtracted} cards
          </Badge>
        )}
      </div>
    </div>
  );
}
```

### B.4 Real-Time Updates Strategy

**Recommended: Polling with Exponential Backoff**

```tsx
// hooks/use-run-progress.ts
"use client";

import { useEffect, useState, useCallback } from "react";

interface RunProgress {
  status: string;
  currentPhase: string | null;
  phases: Phase[];
  counts: {
    uploadsProcessed: number;
    totalUploads: number;
    cardsExtracted: number;
    chunksProcessed: number;
    totalChunks: number;
  };
  elapsedMs: number;
  logs: string[];
}

export function useRunProgress(runId: string, initialData?: RunProgress) {
  const [progress, setProgress] = useState<RunProgress | null>(initialData ?? null);
  const [error, setError] = useState<Error | null>(null);

  // Polling intervals based on run status
  const getInterval = useCallback((status: string) => {
    switch (status) {
      case "RUNNING":
        return 2000;  // 2 seconds when active
      case "QUEUED":
        return 5000;  // 5 seconds when queued
      default:
        return null;  // Stop polling when complete/failed
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/progress`);
        if (!response.ok) throw new Error("Failed to fetch progress");

        const data = await response.json();
        if (!isCancelled) {
          setProgress(data);

          const interval = getInterval(data.status);
          if (interval) {
            timeoutId = setTimeout(poll, interval);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
          // Retry with longer interval on error
          timeoutId = setTimeout(poll, 10000);
        }
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [runId, getInterval]);

  return { progress, error, isLoading: !progress && !error };
}
```

**Alternative: Server-Sent Events (SSE)**
- Better for truly real-time updates
- More complex server implementation
- Use if sub-second updates are critical

---

## C) PROGRESS DISPLAY PATTERNS

### C.1 Step-Based Progress Component

```tsx
// components/runs/step-progress.tsx
"use client";

import { cn } from "@/lib/utils";

interface StepProgressProps {
  current: number;
  total: number;
  label: string;
  sublabel?: string;
}

export function StepProgress({ current, total, label, sublabel }: StepProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {current} / {total}
        </span>
      </div>

      {/* Discrete step indicators instead of continuous bar */}
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label}: ${current} of ${total} complete`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-sm transition-colors",
              i < current
                ? "bg-primary"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
```

### C.2 Count Displays

```tsx
// components/runs/progress-counts.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Layers, FileText, Clock, Zap } from "lucide-react";

interface ProgressCountsProps {
  uploadsProcessed: number;
  totalUploads: number;
  cardsExtracted: number;
  chunksProcessed: number;
  totalChunks: number;
  elapsedMs: number;
  tokensUsed: number;
}

export function ProgressCounts({
  uploadsProcessed,
  totalUploads,
  cardsExtracted,
  chunksProcessed,
  totalChunks,
  elapsedMs,
  tokensUsed,
}: ProgressCountsProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <CountCard
        icon={<FileText className="h-4 w-4" />}
        label="Uploads"
        value={`${uploadsProcessed}/${totalUploads}`}
        description="files analyzed"
      />
      <CountCard
        icon={<Layers className="h-4 w-4" />}
        label="Cards"
        value={cardsExtracted.toString()}
        description="extracted"
      />
      <CountCard
        icon={<Clock className="h-4 w-4" />}
        label="Elapsed"
        value={formatTime(elapsedMs)}
        description="running time"
      />
      <CountCard
        icon={<Zap className="h-4 w-4" />}
        label="Tokens"
        value={tokensUsed.toLocaleString()}
        description="AI tokens used"
      />
    </div>
  );
}

interface CountCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}

function CountCard({ icon, label, value, description }: CountCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
```

### C.3 Phase Transition Display

```tsx
// components/runs/phase-indicator.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhaseIndicatorProps {
  previousPhase?: string;
  currentPhase: string;
  nextPhase?: string;
  isTransitioning?: boolean;
}

export function PhaseIndicator({
  previousPhase,
  currentPhase,
  nextPhase,
  isTransitioning,
}: PhaseIndicatorProps) {
  return (
    <div
      className="flex items-center gap-2 text-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {previousPhase && (
        <>
          <Badge variant="outline" className="text-muted-foreground line-through">
            {previousPhase}
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
        </>
      )}

      <Badge
        variant="default"
        className={cn(isTransitioning && "animate-pulse")}
      >
        {currentPhase}
      </Badge>

      {nextPhase && (
        <>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-muted-foreground">
            {nextPhase}
          </Badge>
        </>
      )}
    </div>
  );
}
```

### C.4 Duration Display

```tsx
// components/runs/duration-display.tsx
"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface DurationDisplayProps {
  startedAt: Date;
  completedAt?: Date | null;
  showEstimate?: boolean;
  estimatedTotalMs?: number;
}

export function DurationDisplay({
  startedAt,
  completedAt,
  showEstimate,
  estimatedTotalMs,
}: DurationDisplayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (completedAt) {
      setElapsed(completedAt.getTime() - startedAt.getTime());
      return;
    }

    const tick = () => {
      setElapsed(Date.now() - startedAt.getTime());
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const remaining = estimatedTotalMs && !completedAt
    ? Math.max(0, estimatedTotalMs - elapsed)
    : null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
        <span className="text-muted-foreground">elapsed</span>
      </div>

      {showEstimate && remaining !== null && remaining > 0 && (
        <div className="text-muted-foreground">
          ~{formatDuration(remaining)} remaining
        </div>
      )}
    </div>
  );
}
```

---

## D) ERROR/RETRY UI

### D.1 Inline Error Display

```tsx
// components/runs/run-error.tsx
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";

interface RunErrorProps {
  error: {
    message: string;
    phase?: string;
    uploadId?: string;
    uploadFilename?: string;
    isRetryable: boolean;
    suggestion?: string;
  };
  onRetry?: () => void;
  onRetryUpload?: (uploadId: string) => void;
  isRetrying?: boolean;
}

export function RunError({
  error,
  onRetry,
  onRetryUpload,
  isRetrying
}: RunErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {error.phase ? `Error in ${error.phase}` : "Analysis Failed"}
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{error.message}</p>

        {error.uploadFilename && (
          <p className="text-sm">
            Failed on: <code className="bg-destructive/10 px-1 rounded">
              {error.uploadFilename}
            </code>
          </p>
        )}

        {error.suggestion && (
          <p className="text-sm text-muted-foreground">
            Suggestion: {error.suggestion}
          </p>
        )}

        {error.isRetryable && (
          <div className="flex gap-2 pt-2">
            {error.uploadId && onRetryUpload ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetryUpload(error.uploadId!)}
                  disabled={isRetrying}
                >
                  <RotateCcw className="mr-2 h-3 w-3" />
                  Retry This Upload
                </Button>
                <Button
                  size="sm"
                  onClick={onRetry}
                  disabled={isRetrying}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry All
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                {isRetrying ? "Retrying..." : "Retry Analysis"}
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

### D.2 Upload-Level Error Row

```tsx
// components/runs/upload-error-row.tsx
"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

interface UploadErrorRowProps {
  uploadId: string;
  filename: string;
  error: string;
  onRetry: (uploadId: string) => void;
  isRetrying: boolean;
}

export function UploadErrorRow({
  uploadId,
  filename,
  error,
  onRetry,
  isRetrying,
}: UploadErrorRowProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{filename}</p>
        <p className="text-sm text-destructive mt-1">{error}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onRetry(uploadId)}
        disabled={isRetrying}
        className="shrink-0"
      >
        <RotateCcw className={cn("h-3 w-3 mr-1", isRetrying && "animate-spin")} />
        Retry
      </Button>
    </div>
  );
}
```

### D.3 Toast Notifications Pattern

```tsx
// lib/toast-patterns.ts
import { toast } from "sonner";

export const runToasts = {
  started: (runType: string) => {
    toast.info(`${runType} started`, {
      description: "Processing your uploads...",
    });
  },

  phaseComplete: (phaseName: string, count?: number) => {
    toast.success(`${phaseName} complete`, {
      description: count ? `Processed ${count} items` : undefined,
    });
  },

  completed: (cardCount: number) => {
    toast.success("Analysis complete", {
      description: `Extracted ${cardCount} use case cards`,
      action: {
        label: "View Cards",
        onClick: () => {
          // Navigate to cards tab
        },
      },
    });
  },

  failed: (error: string, isRetryable: boolean) => {
    toast.error("Analysis failed", {
      description: error,
      duration: isRetryable ? 10000 : 5000,
      action: isRetryable
        ? {
            label: "Retry",
            onClick: () => {
              // Trigger retry
            },
          }
        : undefined,
    });
  },

  uploadFailed: (filename: string, error: string) => {
    toast.error(`Failed: ${filename}`, {
      description: error,
    });
  },
};
```

---

## E) DATA FETCHING STRATEGY

### E.1 Recommended Approach: Server Components + Client Polling

**Rationale:**
- Initial data via Server Components (fast first paint)
- Real-time updates via client-side polling
- No additional dependencies (SWR/React Query not needed for this use case)

### E.2 Server Component Pattern

```tsx
// app/runs/[id]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getRun } from "@/server/actions/generation";
import { RunDetailClient } from "@/components/runs/run-detail-client";
import { RunSkeleton } from "@/components/runs/run-skeleton";

interface RunPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    notFound();
  }

  return (
    <Suspense fallback={<RunSkeleton />}>
      <RunDetailClient initialRun={run} />
    </Suspense>
  );
}
```

### E.3 Client Component with Polling

```tsx
// components/runs/run-detail-client.tsx
"use client";

import { useRunProgress } from "@/hooks/use-run-progress";
import { RunTimeline } from "./run-timeline";
import { ProgressCounts } from "./progress-counts";
import { RunError } from "./run-error";
import { DurationDisplay } from "./duration-display";

interface RunDetailClientProps {
  initialRun: Run;
}

export function RunDetailClient({ initialRun }: RunDetailClientProps) {
  const { progress, error } = useRunProgress(initialRun.id, {
    // Transform initial run data to progress format
    status: initialRun.status,
    phases: parsePhases(initialRun),
    // ...
  });

  // Use progress data, falling back to initial
  const currentData = progress ?? parseInitialData(initialRun);

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <RunHeader run={initialRun} status={currentData.status} />

      {/* Duration display - live updates */}
      {initialRun.startedAt && (
        <DurationDisplay
          startedAt={new Date(initialRun.startedAt)}
          completedAt={initialRun.completedAt ? new Date(initialRun.completedAt) : null}
        />
      )}

      {/* Error display */}
      {currentData.status === "FAILED" && currentData.error && (
        <RunError error={currentData.error} onRetry={handleRetry} />
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RunTimeline
            phases={currentData.phases}
            currentPhaseId={currentData.currentPhase}
          />
        </div>
        <div>
          <ProgressCounts {...currentData.counts} />
        </div>
      </div>
    </div>
  );
}
```

### E.4 Revalidation After Run Completes

```tsx
// hooks/use-run-progress.ts (extended)
import { useRouter } from "next/navigation";

export function useRunProgress(runId: string, initialData?: RunProgress) {
  const router = useRouter();
  const [previousStatus, setPreviousStatus] = useState(initialData?.status);

  // ... existing polling logic

  useEffect(() => {
    // Revalidate page data when run completes
    if (
      previousStatus === "RUNNING" &&
      (progress?.status === "SUCCEEDED" || progress?.status === "FAILED")
    ) {
      router.refresh(); // Triggers Server Component re-render
    }
    setPreviousStatus(progress?.status);
  }, [progress?.status, previousStatus, router]);

  return { progress, error, isLoading };
}
```

### E.5 API Route for Progress

```tsx
// app/api/runs/[id]/progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRunProgress } from "@/server/actions/generation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const progress = await getRunProgress(id);

    if (!progress) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(progress, {
      headers: {
        // Prevent caching for real-time data
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
```

---

## F) ACCESSIBILITY

### F.1 Screen Reader Announcements

```tsx
// components/runs/live-announcer.tsx
"use client";

import { useEffect, useRef } from "react";

interface LiveAnnouncerProps {
  message: string;
  politeness?: "polite" | "assertive";
}

export function LiveAnnouncer({
  message,
  politeness = "polite"
}: LiveAnnouncerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Force re-announcement by clearing and setting
    if (ref.current) {
      ref.current.textContent = "";
      // Small delay ensures screen readers detect the change
      setTimeout(() => {
        if (ref.current) {
          ref.current.textContent = message;
        }
      }, 100);
    }
  }, [message]);

  return (
    <div
      ref={ref}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    />
  );
}
```

### F.2 Progress Announcement Hook

```tsx
// hooks/use-progress-announcements.ts
"use client";

import { useEffect, useState } from "react";

interface Announcement {
  message: string;
  politeness: "polite" | "assertive";
}

export function useProgressAnnouncements(progress: RunProgress | null) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const previousPhase = useRef<string | null>(null);
  const previousStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!progress) return;

    // Announce phase transitions
    if (progress.currentPhase !== previousPhase.current) {
      const phase = progress.phases.find(p => p.id === progress.currentPhase);
      if (phase) {
        setAnnouncement({
          message: `Now ${phase.label.toLowerCase()}: ${phase.description}`,
          politeness: "polite",
        });
      }
      previousPhase.current = progress.currentPhase;
    }

    // Announce status changes
    if (progress.status !== previousStatus.current) {
      if (progress.status === "SUCCEEDED") {
        setAnnouncement({
          message: `Analysis complete. ${progress.counts.cardsExtracted} cards extracted from ${progress.counts.totalUploads} uploads.`,
          politeness: "assertive",
        });
      } else if (progress.status === "FAILED") {
        setAnnouncement({
          message: "Analysis failed. Please check error details and retry.",
          politeness: "assertive",
        });
      }
      previousStatus.current = progress.status;
    }
  }, [progress]);

  return announcement;
}
```

### F.3 Keyboard Navigation in Timeline

```tsx
// components/runs/run-timeline.tsx (accessibility additions)

export function RunTimeline({ phases, currentPhaseId }: RunTimelineProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const phaseRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        const nextIndex = Math.min(index + 1, phases.length - 1);
        setFocusedIndex(nextIndex);
        phaseRefs.current[nextIndex]?.focus();
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setFocusedIndex(prevIndex);
        phaseRefs.current[prevIndex]?.focus();
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        phaseRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        const lastIndex = phases.length - 1;
        setFocusedIndex(lastIndex);
        phaseRefs.current[lastIndex]?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        togglePhase(phases[index].id);
        break;
    }
  };

  return (
    <nav
      className="space-y-1"
      aria-label="Analysis progress"
      role="list"
    >
      {phases.map((phase, index) => (
        <div key={phase.id} role="listitem">
          <CollapsibleTrigger
            ref={(el) => (phaseRefs.current[index] = el)}
            tabIndex={focusedIndex === index ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            aria-expanded={expandedPhases.has(phase.id)}
            aria-controls={`phase-content-${phase.id}`}
            // ... rest of props
          />
          <CollapsibleContent id={`phase-content-${phase.id}`}>
            {/* ... */}
          </CollapsibleContent>
        </div>
      ))}
    </nav>
  );
}
```

### F.4 Focus Management During Async Operations

```tsx
// components/analysis/analyze-project-button.tsx (focus management)

export function AnalyzeProjectButton({ ... }: AnalyzeProjectButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setOpen(false);

    try {
      const result = await startAnalysis(projectId, Array.from(selectedUploads));

      if (result.success && result.runId) {
        // Navigate to run detail page
        router.push(`/runs/${result.runId}`);
      } else {
        // Focus error message for screen readers
        setTimeout(() => errorRef.current?.focus(), 100);
      }
    } catch {
      setTimeout(() => errorRef.current?.focus(), 100);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      {error && (
        <Alert
          ref={errorRef}
          variant="destructive"
          tabIndex={-1}  // Focusable but not in tab order
        >
          {/* ... */}
        </Alert>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Button
            ref={buttonRef}
            aria-busy={isAnalyzing}
            aria-describedby={error ? "analyze-error" : undefined}
          >
            {/* ... */}
          </Button>
        </DialogTrigger>
        {/* ... */}
      </Dialog>
    </>
  );
}
```

### F.5 Reduced Motion Support

```tsx
// components/runs/run-status-badge.tsx (motion-safe animations)

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  return (
    <Badge variant={variant} className="text-xs">
      {status === "RUNNING" && (
        <Loader2
          className={cn(
            "h-3 w-3 mr-1",
            // Only animate if user hasn't requested reduced motion
            "motion-safe:animate-spin"
          )}
        />
      )}
      {/* ... */}
    </Badge>
  );
}
```

---

## G) SHADCN COMPONENT CHOICES

### G.1 Required Components (Already Present)

| Component | Usage |
|-----------|-------|
| `Button` | All action triggers |
| `Dialog` | Upload selection modal |
| `Badge` | Status indicators, counts |
| `Card` | Container for sections |
| `ScrollArea` | Log viewer, upload list |
| `Table` | Upload history |
| `Alert` | Error display |
| `Separator` | Visual dividers |
| `Tabs` | Main navigation (existing) |
| `Progress` | Step progress bars |

### G.2 Components to Add

```bash
npx shadcn@latest add checkbox
npx shadcn@latest add collapsible
npx shadcn@latest add tooltip
```

| Component | Usage |
|-----------|-------|
| `Checkbox` | Upload selection in dialog |
| `Collapsible` | Expandable timeline phases |
| `Tooltip` | Disabled state explanations |

### G.3 Custom Components to Build

| Component | Location | Purpose |
|-----------|----------|---------|
| `AnalyzeProjectButton` | `components/analysis/` | Main trigger with dialog |
| `RunTimeline` | `components/runs/` | Phase visualization |
| `StepProgress` | `components/runs/` | Discrete step indicators |
| `ProgressCounts` | `components/runs/` | Card/upload/token counts |
| `DurationDisplay` | `components/runs/` | Live elapsed time |
| `RunError` | `components/runs/` | Error with retry actions |
| `LiveAnnouncer` | `components/runs/` | Screen reader announcements |
| `PhaseIndicator` | `components/runs/` | Current phase display |

---

## H) FILE STRUCTURE

```
components/
  analysis/
    analyze-project-button.tsx    # Main trigger with dialog
    upload-selector.tsx           # Upload checkbox list
  runs/
    run-timeline.tsx              # Phase timeline
    run-detail-client.tsx         # Client wrapper with polling
    step-progress.tsx             # Discrete step progress
    progress-counts.tsx           # Count displays
    duration-display.tsx          # Live elapsed time
    phase-indicator.tsx           # Current phase badge
    run-error.tsx                 # Error with retry
    upload-error-row.tsx          # Per-upload error
    live-announcer.tsx            # A11y announcements
    run-skeleton.tsx              # Loading state
    run-status-badge.tsx          # (existing, enhanced)
    run-list.tsx                  # (existing)

hooks/
  use-run-progress.ts             # Polling hook
  use-progress-announcements.ts   # A11y hook
  use-elapsed-time.ts             # Timer hook

lib/
  run-phases.ts                   # Phase configuration
  toast-patterns.ts               # Toast helpers

app/
  api/
    runs/
      [id]/
        progress/
          route.ts                # Progress polling endpoint
```

---

## I) IMPLEMENTATION PRIORITY

### Phase 1: Core Trigger
1. Add `Checkbox` and `Collapsible` shadcn components
2. Build `AnalyzeProjectButton` component
3. Integrate into project page header
4. Create API endpoint for starting analysis run

### Phase 2: Progress Display
1. Build `RunTimeline` with basic phases
2. Implement `useRunProgress` polling hook
3. Add `ProgressCounts` component
4. Create progress API endpoint

### Phase 3: Real-Time Updates
1. Add per-upload breakdown to timeline
2. Implement `DurationDisplay` with live updates
3. Add log viewer with expandable phases
4. Implement revalidation on completion

### Phase 4: Error Handling
1. Build `RunError` component
2. Add retry functionality (full and per-upload)
3. Implement toast notification patterns
4. Add error-specific guidance

### Phase 5: Accessibility Polish
1. Add `LiveAnnouncer` component
2. Implement keyboard navigation
3. Add progress announcements hook
4. Test with screen readers
5. Add reduced motion support

---

## J) TESTING CONSIDERATIONS

### Unit Tests
- Button disabled states based on props
- Phase status rendering
- Duration formatting
- Announcement message generation

### Integration Tests
- Dialog open/close flow
- Upload selection persistence
- Polling start/stop on mount/unmount
- Revalidation after completion

### Accessibility Tests
- Keyboard navigation through timeline
- Screen reader announcement timing
- Focus management after actions
- Color contrast for status indicators

### E2E Tests
- Full analysis workflow from trigger to completion
- Error recovery and retry flows
- Real-time update rendering
