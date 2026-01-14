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
  ListTodo,
  X,
  RefreshCw,
  Clock,
  ChevronDown,
  Layers,
  Save,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";
import { useSubtaskProgress } from "@/hooks/use-subtask-progress";
import { cancelBatchSubtaskRun, retryFailedStories } from "@/server/actions/subtasks";
import { RunStatus, RunPhase, RunStoryStatus } from "@/lib/types";
import type { BatchSubtaskProgress, RunStoryProgress } from "@/lib/types";

// ============================================
// Types
// ============================================

interface SubtaskRunProgressProps {
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
    case RunPhase.QUEUEING_STORIES:
      return "Preparing queue";
    case RunPhase.GENERATING_SUBTASKS:
      return "Generating subtasks";
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
    RunPhase.QUEUEING_STORIES,
    RunPhase.GENERATING_SUBTASKS,
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
// Story Timeline Item Component
// ============================================

function StoryTimelineItem({ story }: { story: RunStoryProgress }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusVariant =
    story.status === RunStoryStatus.COMPLETED
      ? "success"
      : story.status === RunStoryStatus.FAILED
        ? "destructive"
        : story.status === RunStoryStatus.SKIPPED
          ? "warning"
          : story.status === RunStoryStatus.GENERATING ||
              story.status === RunStoryStatus.SAVING
            ? "info"
            : "muted";

  const statusLabel =
    story.status === RunStoryStatus.COMPLETED
      ? "Complete"
      : story.status === RunStoryStatus.FAILED
        ? "Failed"
        : story.status === RunStoryStatus.SKIPPED
          ? "Skipped"
          : story.status === RunStoryStatus.GENERATING
            ? "Generating"
            : story.status === RunStoryStatus.SAVING
              ? "Saving"
              : "Pending";

  const isActive =
    story.status === RunStoryStatus.GENERATING ||
    story.status === RunStoryStatus.SAVING;

  const StatusIcon =
    story.status === RunStoryStatus.COMPLETED
      ? CheckCircle2
      : story.status === RunStoryStatus.FAILED
        ? XCircle
        : story.status === RunStoryStatus.SKIPPED
          ? SkipForward
          : story.status === RunStoryStatus.SAVING
            ? Save
            : isActive
              ? ListTodo
              : Circle;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            story.status === RunStoryStatus.COMPLETED &&
              "border-success/30 bg-success/5",
            story.status === RunStoryStatus.FAILED &&
              "border-destructive/30 bg-destructive/5",
            story.status === RunStoryStatus.SKIPPED &&
              "border-warning/30 bg-warning/5",
            isActive && "border-primary/30 bg-primary/5",
            !isActive &&
              story.status !== RunStoryStatus.COMPLETED &&
              story.status !== RunStoryStatus.FAILED &&
              story.status !== RunStoryStatus.SKIPPED &&
              "border-border"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                story.status === RunStoryStatus.COMPLETED && "bg-success/10",
                story.status === RunStoryStatus.FAILED && "bg-destructive/10",
                story.status === RunStoryStatus.SKIPPED && "bg-warning/10",
                isActive && "bg-primary/10",
                !isActive &&
                  story.status !== RunStoryStatus.COMPLETED &&
                  story.status !== RunStoryStatus.FAILED &&
                  story.status !== RunStoryStatus.SKIPPED &&
                  "bg-muted"
              )}
            >
              <StatusIcon
                className={cn(
                  "h-4 w-4",
                  story.status === RunStoryStatus.COMPLETED && "text-success",
                  story.status === RunStoryStatus.FAILED && "text-destructive",
                  story.status === RunStoryStatus.SKIPPED && "text-warning",
                  isActive && "text-primary animate-pulse",
                  !isActive &&
                    story.status !== RunStoryStatus.COMPLETED &&
                    story.status !== RunStoryStatus.FAILED &&
                    story.status !== RunStoryStatus.SKIPPED &&
                    "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {story.storyCode}: {story.storyTitle}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusPill variant={statusVariant} pulse={isActive}>
                  {statusLabel}
                </StatusPill>
                {story.subtasksCreated > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ListTodo className="h-3 w-3" aria-hidden="true" />
                    {story.subtasksCreated} subtasks
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {story.durationMs && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(story.durationMs)}
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
          {story.status === RunStoryStatus.FAILED && story.error && (
            <p className="text-destructive">{story.error}</p>
          )}
          {story.status === RunStoryStatus.COMPLETED && (
            <p className="text-muted-foreground">
              Successfully generated {story.subtasksCreated} subtasks.
              {story.subtasksDeleted > 0 && ` Replaced ${story.subtasksDeleted} existing subtasks.`}
            </p>
          )}
          {story.status === RunStoryStatus.SKIPPED && (
            <p className="text-muted-foreground">
              Skipped because this story already has subtasks.
            </p>
          )}
          {isActive && (
            <p className="text-muted-foreground">
              {story.status === RunStoryStatus.GENERATING
                ? "Generating subtasks with AI..."
                : "Saving generated subtasks to database..."}
            </p>
          )}
          {story.status === RunStoryStatus.PENDING && (
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

export function SubtaskRunProgress({
  runId,
  projectId,
  onClose,
}: SubtaskRunProgressProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const { progress, isLoading, error, isActive, isComplete, hasFailed, hasPartialSuccess } =
    useSubtaskProgress(runId, {
      pollInterval: 1000,
      onComplete: (prog) => {
        const message =
          prog.status === RunStatus.PARTIAL
            ? `Generation complete with ${prog.failedStories} failed. ${prog.totalSubtasksCreated} subtasks created.`
            : `Generation complete! ${prog.totalSubtasksCreated} subtasks created from ${prog.completedStories} stories.`;
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
      const result = await cancelBatchSubtaskRun(runId);
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
      const result = await retryFailedStories(runId);
      if (result.success && result.runId) {
        toast.success(`Retrying ${result.storyCount} failed stories...`);
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
    progress.completedStories + progress.failedStories + progress.skippedStories;
  const progressPercent =
    progress.totalStories > 0
      ? Math.round((processedCount / progress.totalStories) * 100)
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
    { phase: RunPhase.QUEUEING_STORIES, label: "Queue Stories" },
    { phase: RunPhase.GENERATING_SUBTASKS, label: "Generate Subtasks" },
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
                  <ListTodo className="h-4 w-4" aria-hidden="true" />
                </div>
                <span>Generating Subtasks</span>
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
              {processedCount} of {progress.totalStories} stories processed
            </span>
            <span className="font-semibold text-primary">
              {progress.totalSubtasksCreated} subtasks created
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {progress.currentStoryTitle && isActive && (
            <p className="text-xs text-muted-foreground">
              Currently processing: {progress.currentStoryTitle}
            </p>
          )}
          {progress.estimatedRemainingMs && isActive && (
            <p className="text-xs text-muted-foreground text-right">
              ~{formatDuration(progress.estimatedRemainingMs)} remaining
            </p>
          )}
        </div>

        {/* Story List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Story Queue
          </h4>
          <ScrollArea className="h-[240px] pr-4">
            <div className="space-y-2">
              {progress.stories.map((story) => (
                <StoryTimelineItem key={story.storyId} story={story} />
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
            {progress.failedStories > 0 && (
              <StatusPill variant="destructive">
                {progress.failedStories} failed
              </StatusPill>
            )}
            {progress.skippedStories > 0 && (
              <StatusPill variant="warning">
                {progress.skippedStories} skipped
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

            {isComplete && progress.failedStories > 0 && (
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
                Retry Failed ({progress.failedStories})
              </Button>
            )}

            {isComplete && (progress.status === RunStatus.SUCCEEDED || hasPartialSuccess) && (
              <Button size="sm" onClick={() => router.refresh()}>
                <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                View {progress.totalSubtasksCreated} Subtasks
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
