"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Check,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  FileText,
} from "lucide-react";

export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export interface UploadProgress {
  uploadId: string;
  filename: string;
  status: PhaseStatus;
  chunksProcessed?: number;
  totalChunks?: number;
  cardsExtracted?: number;
  error?: string;
}

export interface Phase {
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
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() =>
    new Set([currentPhaseId].filter(Boolean) as string[])
  );
  const [focusedIndex, setFocusedIndex] = useState(0);
  const phaseRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
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
          const phase = phases[index];
          if (phase.uploads?.length || phase.logs?.length) {
            togglePhase(phase.id);
          }
          break;
      }
    },
    [phases, togglePhase]
  );

  const getPhaseIcon = (status: PhaseStatus, isCurrent: boolean) => {
    if (status === "completed") {
      return <Check className="h-4 w-4 text-green-600" aria-hidden="true" />;
    }
    if (status === "failed") {
      return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
    }
    if (status === "running" || isCurrent) {
      return (
        <Loader2
          className="h-4 w-4 text-primary motion-safe:animate-spin"
          aria-hidden="true"
        />
      );
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

  const getStatusLabel = (status: PhaseStatus) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "running":
        return "In progress";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <nav className="space-y-1" aria-label="Analysis progress" role="list">
      {phases.map((phase, index) => {
        const isCurrent = phase.id === currentPhaseId;
        const isExpanded = expandedPhases.has(phase.id);
        const hasDetails = (phase.uploads?.length ?? 0) > 0 || (phase.logs?.length ?? 0) > 0;
        const isLastPhase = index === phases.length - 1;

        return (
          <div
            key={phase.id}
            role="listitem"
            aria-current={isCurrent ? "step" : undefined}
            className="relative"
          >
            {/* Timeline connector line */}
            {!isLastPhase && (
              <div
                className={cn(
                  "absolute left-3 top-6 w-0.5 h-full -ml-px",
                  phase.status === "completed" ? "bg-green-600" : "bg-muted"
                )}
                aria-hidden="true"
              />
            )}

            <div className="relative pl-8 pb-6">
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
                aria-hidden="true"
              >
                {getPhaseIcon(phase.status, isCurrent)}
              </div>

              {/* Phase content */}
              <Collapsible
                open={isExpanded}
                onOpenChange={() => hasDetails && togglePhase(phase.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <CollapsibleTrigger
                    ref={(el: HTMLButtonElement | null) => {
                      phaseRefs.current[index] = el;
                    }}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, index)}
                    className={cn(
                      "flex items-center gap-2 text-left rounded-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      hasDetails && "cursor-pointer hover:text-foreground"
                    )}
                    disabled={!hasDetails}
                    aria-expanded={hasDetails ? isExpanded : undefined}
                    aria-controls={hasDetails ? `phase-content-${phase.id}` : undefined}
                    aria-label={`${phase.label}: ${getStatusLabel(phase.status)}${hasDetails ? ", press Enter to expand" : ""}`}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        phase.status === "pending" && "text-muted-foreground",
                        phase.status === "running" && "text-foreground",
                        phase.status === "completed" && "text-foreground",
                        phase.status === "failed" && "text-destructive"
                      )}
                    >
                      {phase.label}
                    </span>
                    {hasDetails && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </CollapsibleTrigger>

                  {phase.durationMs && (
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {formatDuration(phase.durationMs)}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mt-0.5">
                  {phase.description}
                </p>

                <CollapsibleContent
                  id={`phase-content-${phase.id}`}
                  className="mt-3 space-y-3"
                >
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
                    <ScrollArea className="h-[120px] rounded border bg-muted/30 p-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {phase.logs.join("\n")}
                      </pre>
                    </ScrollArea>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

interface UploadProgressRowProps {
  upload: UploadProgress;
}

function UploadProgressRow({ upload }: UploadProgressRowProps) {
  const getStatusIndicator = () => {
    switch (upload.status) {
      case "completed":
        return <Check className="h-3 w-3 text-green-600" aria-hidden="true" />;
      case "running":
        return (
          <Loader2
            className="h-3 w-3 text-primary motion-safe:animate-spin"
            aria-hidden="true"
          />
        );
      case "failed":
        return <AlertCircle className="h-3 w-3 text-destructive" aria-hidden="true" />;
      default:
        return <FileText className="h-3 w-3 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case "completed":
        return "Completed";
      case "running":
        return "Processing";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <div
      className={cn(
        "flex items-start justify-between text-sm py-2 px-2 rounded",
        upload.status === "failed" && "bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {getStatusIndicator()}
        <span className="truncate" title={upload.filename}>
          {upload.filename}
        </span>
        <span className="sr-only">{getStatusText()}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs shrink-0">
        {upload.chunksProcessed !== undefined && upload.totalChunks !== undefined && (
          <span className="tabular-nums">
            chunk {upload.chunksProcessed}/{upload.totalChunks}
          </span>
        )}
        {upload.cardsExtracted !== undefined && upload.cardsExtracted > 0 && (
          <Badge variant="secondary" className="text-xs">
            {upload.cardsExtracted} card{upload.cardsExtracted !== 1 ? "s" : ""}
          </Badge>
        )}
        {upload.error && (
          <span className="text-destructive truncate max-w-[150px]" title={upload.error}>
            {upload.error}
          </span>
        )}
      </div>
    </div>
  );
}
