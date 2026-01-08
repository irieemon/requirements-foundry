"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Sparkles,
  X,
  RefreshCw,
  Clock,
  ChevronDown,
  Layers,
  BookOpen,
  SkipForward,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useBatchStoryProgress } from "@/hooks/use-batch-story-progress";
import { cancelBatchStoryRun, retryFailedEpics } from "@/server/actions/batch-stories";
import { RunStatus, RunPhase, RunEpicStatus } from "@/lib/types";
import type { BatchStoryProgress, RunEpicProgress } from "@/lib/types";

// ============================================
// Types
// ============================================

interface BatchStoryRunProgressProps {
  runId: string;
  projectId: string;
  onClose?: () => void;
}

// ============================================
// Format Duration
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ============================================
// Phase Label
// ============================================

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case RunPhase.INITIALIZING:
      return "Initializing";
    case RunPhase.QUEUEING_EPICS:
      return "Preparing queue";
    case RunPhase.GENERATING_STORIES:
      return "Generating stories";
    case RunPhase.FINALIZING:
      return "Finalizing";
    case RunPhase.COMPLETED:
      return "Complete";
    case RunPhase.FAILED:
      return "Failed";
    default:
      return phase;
  }
}

// ============================================
// Timeline Step Component
// ============================================

type StepStatus = "pending" | "active" | "completed" | "failed";

function getStepStatus(
  currentPhase: string,
  stepPhase: string,
  runStatus: string
): StepStatus {
  const phaseOrder: string[] = [
    RunPhase.INITIALIZING,
    RunPhase.QUEUEING_EPICS,
    RunPhase.GENERATING_STORIES,
    RunPhase.FINALIZING,
    RunPhase.COMPLETED,
  ];

  const currentIndex = phaseOrder.indexOf(currentPhase);
  const stepIndex = phaseOrder.indexOf(stepPhase);

  if (runStatus === RunStatus.FAILED && currentPhase === stepPhase) {
    return "failed";
  }
  if (currentIndex > stepIndex) return "completed";
  if (currentIndex === stepIndex) return "active";
  return "pending";
}

interface TimelineStepProps {
  label: string;
  status: StepStatus;
  isLast?: boolean;
}

function TimelineStep({ label, status, isLast = false }: TimelineStepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors",
            status === "completed" &&
              "border-success bg-success text-success-foreground",
            status === "active" &&
              "border-primary bg-primary/10 text-primary",
            status === "failed" &&
              "border-destructive bg-destructive text-destructive-foreground",
            status === "pending" && "border-border bg-muted text-muted-foreground"
          )}
        >
          {status === "completed" && (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          {status === "active" && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {status === "failed" && (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {status === "pending" && (
            <Circle className="h-3 w-3" aria-hidden="true" />
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              "w-0.5 h-6 mt-1",
              status === "completed" ? "bg-success" : "bg-border"
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium pt-1",
          status === "active" && "text-primary",
          status === "completed" && "text-foreground",
          status === "failed" && "text-destructive",
          status === "pending" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================
// Epic Timeline Item Component
// ============================================

function EpicTimelineItem({ epic }: { epic: RunEpicProgress }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusVariant =
    epic.status === RunEpicStatus.COMPLETED
      ? "success"
      : epic.status === RunEpicStatus.FAILED
        ? "destructive"
        : epic.status === RunEpicStatus.SKIPPED
          ? "warning"
          : epic.status === RunEpicStatus.GENERATING ||
              epic.status === RunEpicStatus.SAVING
            ? "info"
            : "muted";

  const statusLabel =
    epic.status === RunEpicStatus.COMPLETED
      ? "Complete"
      : epic.status === RunEpicStatus.FAILED
        ? "Failed"
        : epic.status === RunEpicStatus.SKIPPED
          ? "Skipped"
          : epic.status === RunEpicStatus.GENERATING
            ? "Generating"
            : epic.status === RunEpicStatus.SAVING
              ? "Saving"
              : "Pending";

  const isActive =
    epic.status === RunEpicStatus.GENERATING ||
    epic.status === RunEpicStatus.SAVING;

  const StatusIcon =
    epic.status === RunEpicStatus.COMPLETED
      ? CheckCircle2
      : epic.status === RunEpicStatus.FAILED
        ? XCircle
        : epic.status === RunEpicStatus.SKIPPED
          ? SkipForward
          : epic.status === RunEpicStatus.SAVING
            ? Save
            : isActive
              ? Sparkles
              : Circle;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            epic.status === RunEpicStatus.COMPLETED &&
              "border-success/30 bg-success/5",
            epic.status === RunEpicStatus.FAILED &&
              "border-destructive/30 bg-destructive/5",
            epic.status === RunEpicStatus.SKIPPED &&
              "border-warning/30 bg-warning/5",
            isActive && "border-primary/30 bg-primary/5",
            !isActive &&
              epic.status !== RunEpicStatus.COMPLETED &&
              epic.status !== RunEpicStatus.FAILED &&
              epic.status !== RunEpicStatus.SKIPPED &&
              "border-border"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                epic.status === RunEpicStatus.COMPLETED && "bg-success/10",
                epic.status === RunEpicStatus.FAILED && "bg-destructive/10",
                epic.status === RunEpicStatus.SKIPPED && "bg-warning/10",
                isActive && "bg-primary/10",
                !isActive &&
                  epic.status !== RunEpicStatus.COMPLETED &&
                  epic.status !== RunEpicStatus.FAILED &&
                  epic.status !== RunEpicStatus.SKIPPED &&
                  "bg-muted"
              )}
            >
              <StatusIcon
                className={cn(
                  "h-4 w-4",
                  epic.status === RunEpicStatus.COMPLETED && "text-success",
                  epic.status === RunEpicStatus.FAILED && "text-destructive",
                  epic.status === RunEpicStatus.SKIPPED && "text-warning",
                  isActive && "text-primary animate-pulse",
                  !isActive &&
                    epic.status !== RunEpicStatus.COMPLETED &&
                    epic.status !== RunEpicStatus.FAILED &&
                    epic.status !== RunEpicStatus.SKIPPED &&
                    "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {epic.epicCode}: {epic.epicTitle}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusPill variant={statusVariant} pulse={isActive}>
                  {statusLabel}
                </StatusPill>
                {epic.storiesCreated > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" aria-hidden="true" />
                    {epic.storiesCreated} stories
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {epic.durationMs && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(epic.durationMs)}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-2 ml-11 text-sm">
          {epic.status === RunEpicStatus.FAILED && epic.error && (
            <p className="text-destructive">{epic.error}</p>
          )}
          {epic.status === RunEpicStatus.COMPLETED && (
            <p className="text-muted-foreground">
              Successfully generated {epic.storiesCreated} stories.
              {epic.storiesDeleted > 0 && ` Replaced ${epic.storiesDeleted} existing stories.`}
            </p>
          )}
          {epic.status === RunEpicStatus.SKIPPED && (
            <p className="text-muted-foreground">
              Skipped because this epic already has stories.
            </p>
          )}
          {isActive && (
            <p className="text-muted-foreground">
              {epic.status === RunEpicStatus.GENERATING
                ? "Generating user stories with AI..."
                : "Saving generated stories to database..."}
            </p>
          )}
          {epic.status === RunEpicStatus.PENDING && (
            <p className="text-muted-foreground">Waiting in queue...</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Main Component
// ============================================

export function BatchStoryRunProgress({
  runId,
  projectId,
  onClose,
}: BatchStoryRunProgressProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const { progress, isLoading, error, isActive, isComplete, hasFailed, hasPartialSuccess } =
    useBatchStoryProgress(runId, {
      pollInterval: 1000,
      onComplete: (prog) => {
        const message =
          prog.status === RunStatus.PARTIAL
            ? `Generation complete with ${prog.failedEpics} failed. ${prog.totalStoriesCreated} stories created.`
            : `Generation complete! ${prog.totalStoriesCreated} stories created from ${prog.completedEpics} epics.`;
        toast.success(message);
      },
      onError: (prog) => {
        toast.error(`Generation failed: ${prog.error || "Unknown error"}`);
      },
      onCancel: () => {
        toast.info("Generation cancelled");
      },
    });

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelBatchStoryRun(runId);
      if (!result.success) {
        toast.error(result.error || "Failed to cancel");
      }
    } catch (err) {
      toast.error("Failed to cancel generation");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const result = await retryFailedEpics(runId);
      if (result.success && result.runId) {
        toast.success(`Retrying ${result.epicCount} failed epics...`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to retry");
      }
    } catch (err) {
      toast.error("Failed to retry");
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading && !progress) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !progress) {
    return (
      <Card className="border-destructive/50 shadow-sm">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-destructive">
            <XCircle className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) return null;

  const processedCount =
    progress.completedEpics + progress.failedEpics + progress.skippedEpics;
  const progressPercent =
    progress.totalEpics > 0
      ? Math.round((processedCount / progress.totalEpics) * 100)
      : 0;

  const runStatusVariant =
    progress.status === RunStatus.SUCCEEDED
      ? "success"
      : progress.status === RunStatus.PARTIAL
        ? "warning"
        : progress.status === RunStatus.FAILED
          ? "destructive"
          : progress.status === RunStatus.RUNNING
            ? "info"
            : "muted";

  const phases = [
    { phase: RunPhase.INITIALIZING, label: "Initialize" },
    { phase: RunPhase.QUEUEING_EPICS, label: "Queue Epics" },
    { phase: RunPhase.GENERATING_STORIES, label: "Generate Stories" },
    { phase: RunPhase.FINALIZING, label: "Finalize" },
  ];

  return (
    <Card className="border-primary/20 shadow-md overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <span>Generating Stories</span>
              </CardTitle>
              <div className="flex items-center gap-3">
                <StatusPill
                  variant={runStatusVariant}
                  pulse={progress.status === RunStatus.RUNNING}
                >
                  {progress.status === RunStatus.RUNNING
                    ? "Running"
                    : progress.status === RunStatus.SUCCEEDED
                      ? "Complete"
                      : progress.status === RunStatus.PARTIAL
                        ? "Partial"
                        : progress.status === RunStatus.FAILED
                          ? "Failed"
                          : progress.status === RunStatus.CANCELLED
                            ? "Cancelled"
                            : progress.status}
                </StatusPill>
                {progress.elapsedMs && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatDuration(progress.elapsedMs)}
                  </span>
                )}
              </div>
            </div>
            {onClose && isComplete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Phase Timeline */}
        <div className="flex items-start justify-between">
          {phases.map((step, index) => (
            <TimelineStep
              key={step.phase}
              label={step.label}
              status={getStepStatus(progress.phase, step.phase, progress.status)}
              isLast={index === phases.length - 1}
            />
          ))}
        </div>

        {/* Progress Summary */}
        <div className="space-y-3 rounded-lg bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {processedCount} of {progress.totalEpics} epics processed
            </span>
            <span className="font-semibold text-primary">
              {progress.totalStoriesCreated} stories created
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {progress.currentEpicTitle && isActive && (
            <p className="text-xs text-muted-foreground">
              Currently processing: {progress.currentEpicTitle}
            </p>
          )}
          {progress.estimatedRemainingMs && isActive && (
            <p className="text-xs text-muted-foreground text-right">
              ~{formatDuration(progress.estimatedRemainingMs)} remaining
            </p>
          )}
        </div>

        {/* Epic List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Epic Queue
          </h4>
          <ScrollArea className="h-[240px] pr-4">
            <div className="space-y-2">
              {progress.epics.map((epic) => (
                <EpicTimelineItem key={epic.epicId} epic={epic} />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Error Message */}
        {progress.error && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-destructive">{progress.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            {progress.failedEpics > 0 && (
              <StatusPill variant="destructive">
                {progress.failedEpics} failed
              </StatusPill>
            )}
            {progress.skippedEpics > 0 && (
              <StatusPill variant="warning">
                {progress.skippedEpics} skipped
              </StatusPill>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  "Cancel"
                )}
              </Button>
            )}

            {isComplete && progress.failedEpics > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                Retry Failed ({progress.failedEpics})
              </Button>
            )}

            {isComplete && (progress.status === RunStatus.SUCCEEDED || hasPartialSuccess) && (
              <Button size="sm" onClick={() => router.refresh()}>
                <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                View {progress.totalStoriesCreated} Stories
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
