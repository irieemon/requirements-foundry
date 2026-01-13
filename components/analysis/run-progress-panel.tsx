"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Database,
  ChevronDown,
  FileText,
  Layers,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useRunProgress } from "@/hooks/use-run-progress";
import { cancelRun, retryFailedUploads } from "@/server/actions/analysis";
import { RunStatus, RunPhase, RunUploadStatus } from "@/lib/types";
import type { RunProgress, RunUploadProgress } from "@/lib/types";

interface RunProgressPanelProps {
  runId: string;
  projectId: string;
  onClose?: () => void;
}

// ============================================
// Timeline Step Status
// ============================================

type StepStatus = "pending" | "active" | "completed" | "failed";

function getStepStatus(
  currentPhase: string,
  stepPhase: string,
  runStatus: string
): StepStatus {
  const phaseOrder: string[] = [
    RunPhase.INITIALIZING,
    RunPhase.LOADING_CONTENT,
    RunPhase.ANALYZING,
    RunPhase.SAVING_RESULTS,
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

// ============================================
// Timeline Step Component
// ============================================

interface TimelineStepProps {
  label: string;
  status: StepStatus;
  isLast?: boolean;
}

function TimelineStep({ label, status, isLast = false }: TimelineStepProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Status indicator */}
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
        {/* Connector line */}
        {!isLast && (
          <div
            className={cn(
              "w-0.5 h-6 mt-1",
              status === "completed" ? "bg-success" : "bg-border"
            )}
          />
        )}
      </div>
      {/* Label */}
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
// Phase Label
// ============================================

function getPhaseLabel(phase: string): string {
  switch (phase) {
    case RunPhase.INITIALIZING:
      return "Initializing";
    case RunPhase.LOADING_CONTENT:
      return "Loading documents";
    case RunPhase.ANALYZING:
      return "Analyzing with AI";
    case RunPhase.SAVING_RESULTS:
      return "Saving results";
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
// Format Elapsed Time (live counter)
// ============================================

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// ============================================
// Extract Current Document from Phase Detail
// ============================================

function extractCurrentDocument(
  phaseDetail: string | undefined,
  uploads: RunUploadProgress[]
): { filename: string; uploadIndex: number; totalUploads: number } | null {
  // First try to parse phaseDetail format: "Processing upload X of Y: filename"
  if (phaseDetail) {
    const match = phaseDetail.match(
      /Processing upload (\d+) of (\d+): (.+)/
    );
    if (match) {
      return {
        uploadIndex: parseInt(match[1], 10),
        totalUploads: parseInt(match[2], 10),
        filename: match[3],
      };
    }
  }

  // Fallback: find the currently active upload from uploads array
  const activeUpload = uploads.find(
    (u) =>
      u.status === RunUploadStatus.LOADING ||
      u.status === RunUploadStatus.ANALYZING ||
      u.status === RunUploadStatus.SAVING
  );

  if (activeUpload) {
    const uploadIndex = uploads.findIndex((u) => u.uploadId === activeUpload.uploadId) + 1;
    return {
      filename: activeUpload.filename,
      uploadIndex,
      totalUploads: uploads.length,
    };
  }

  return null;
}

// ============================================
// Upload Timeline Item Component
// ============================================

function UploadTimelineItem({ upload }: { upload: RunUploadProgress }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusVariant =
    upload.status === RunUploadStatus.COMPLETED
      ? "success"
      : upload.status === RunUploadStatus.FAILED
        ? "destructive"
        : upload.status === RunUploadStatus.ANALYZING ||
            upload.status === RunUploadStatus.LOADING ||
            upload.status === RunUploadStatus.SAVING
          ? "info"
          : "muted";

  const statusLabel =
    upload.status === RunUploadStatus.COMPLETED
      ? "Complete"
      : upload.status === RunUploadStatus.FAILED
        ? "Failed"
        : upload.status === RunUploadStatus.ANALYZING
          ? "Analyzing"
          : upload.status === RunUploadStatus.LOADING
            ? "Loading"
            : upload.status === RunUploadStatus.SAVING
              ? "Saving"
              : upload.status === RunUploadStatus.SKIPPED
                ? "Skipped"
                : "Pending";

  const isActive =
    upload.status === RunUploadStatus.ANALYZING ||
    upload.status === RunUploadStatus.LOADING ||
    upload.status === RunUploadStatus.SAVING;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all",
            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            upload.status === RunUploadStatus.COMPLETED &&
              "border-success/30 bg-success/5",
            upload.status === RunUploadStatus.FAILED &&
              "border-destructive/30 bg-destructive/5",
            isActive && "border-primary/30 bg-primary/5",
            !isActive &&
              upload.status !== RunUploadStatus.COMPLETED &&
              upload.status !== RunUploadStatus.FAILED &&
              "border-border"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                upload.status === RunUploadStatus.COMPLETED && "bg-success/10",
                upload.status === RunUploadStatus.FAILED && "bg-destructive/10",
                isActive && "bg-primary/10",
                !isActive &&
                  upload.status !== RunUploadStatus.COMPLETED &&
                  upload.status !== RunUploadStatus.FAILED &&
                  "bg-muted"
              )}
            >
              <FileText
                className={cn(
                  "h-4 w-4",
                  upload.status === RunUploadStatus.COMPLETED && "text-success",
                  upload.status === RunUploadStatus.FAILED && "text-destructive",
                  isActive && "text-primary",
                  !isActive &&
                    upload.status !== RunUploadStatus.COMPLETED &&
                    upload.status !== RunUploadStatus.FAILED &&
                    "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{upload.filename}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusPill variant={statusVariant} pulse={isActive}>
                  {statusLabel}
                </StatusPill>
                {upload.cardsCreated > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {upload.cardsCreated} cards
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {upload.durationMs && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(upload.durationMs)}
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
          {upload.status === RunUploadStatus.FAILED && upload.error && (
            <p className="text-destructive">{upload.error}</p>
          )}
          {upload.status === RunUploadStatus.COMPLETED && (
            <p className="text-muted-foreground">
              Successfully extracted {upload.cardsCreated} use case cards from
              this document.
            </p>
          )}
          {upload.status === RunUploadStatus.SKIPPED && (
            <p className="text-muted-foreground">
              This document was skipped (already analyzed or not eligible).
            </p>
          )}
          {isActive && (
            <p className="text-muted-foreground">Processing document...</p>
          )}
          {upload.status === RunUploadStatus.PENDING && (
            <p className="text-muted-foreground">Waiting to be processed...</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Currently Processing Banner Component
// ============================================

interface CurrentlyProcessingBannerProps {
  currentDoc: { filename: string; uploadIndex: number; totalUploads: number };
  elapsedSeconds: number;
  activeStatus: string;
}

function CurrentlyProcessingBanner({
  currentDoc,
  elapsedSeconds,
  activeStatus,
}: CurrentlyProcessingBannerProps) {
  const statusLabel =
    activeStatus === RunUploadStatus.ANALYZING
      ? "Analyzing with AI"
      : activeStatus === RunUploadStatus.LOADING
        ? "Loading content"
        : activeStatus === RunUploadStatus.SAVING
          ? "Saving results"
          : "Processing";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Pulsing indicator */}
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute h-10 w-10 animate-ping rounded-full bg-primary/20" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {statusLabel}
            </p>
            <p className="text-sm text-muted-foreground truncate max-w-[280px]">
              Document {currentDoc.uploadIndex} of {currentDoc.totalUploads}:{" "}
              <span className="font-medium text-foreground">{currentDoc.filename}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono font-medium text-primary">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function RunProgressPanel({
  runId,
  projectId,
  onClose,
}: RunProgressPanelProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [processingElapsed, setProcessingElapsed] = useState(0);
  const processingStartRef = useRef<number | null>(null);

  const { progress, isLoading, error, isActive, isComplete } = useRunProgress(
    runId,
    {
      pollInterval: 1000,
      onComplete: (prog) => {
        toast.success(
          `Analysis complete! ${prog.totalCards} cards extracted from ${prog.completedUploads} documents.`
        );
      },
      onError: (prog) => {
        toast.error(`Analysis failed: ${prog.error || "Unknown error"}`);
      },
      onCancel: () => {
        toast.info("Analysis cancelled");
      },
    }
  );

  // Extract current document info
  const currentDoc = progress
    ? extractCurrentDocument(progress.phaseDetail, progress.uploads)
    : null;

  // Find the active upload status for banner display
  const activeUpload = progress?.uploads.find(
    (u) =>
      u.status === RunUploadStatus.LOADING ||
      u.status === RunUploadStatus.ANALYZING ||
      u.status === RunUploadStatus.SAVING
  );

  // Elapsed time counter for currently processing document
  useEffect(() => {
    // Only run timer when we have an actively processing document
    if (!isActive || !currentDoc || !activeUpload) {
      processingStartRef.current = null;
      setProcessingElapsed(0);
      return;
    }

    // Start timing from now if we just started or document changed
    if (processingStartRef.current === null) {
      processingStartRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (processingStartRef.current) {
        const elapsed = Math.floor((Date.now() - processingStartRef.current) / 1000);
        setProcessingElapsed(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, currentDoc?.filename, activeUpload?.uploadId]);

  // Reset timer when the active document changes
  useEffect(() => {
    if (activeUpload?.uploadId) {
      processingStartRef.current = Date.now();
      setProcessingElapsed(0);
    }
  }, [activeUpload?.uploadId]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelRun(runId);
      if (!result.success) {
        toast.error(result.error || "Failed to cancel");
      }
    } catch (err) {
      toast.error("Failed to cancel analysis");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const result = await retryFailedUploads(runId);
      if (result.success && result.runId) {
        toast.success("Retrying failed uploads...");
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

  // Calculate progress percentages for completed and in-progress
  const completedPercent =
    progress.totalUploads > 0
      ? ((progress.completedUploads + progress.failedUploads) /
          progress.totalUploads) *
        100
      : 0;

  // Count actively processing uploads (LOADING, ANALYZING, SAVING)
  const analyzingCount = progress.uploads.filter(
    (u) =>
      u.status === RunUploadStatus.LOADING ||
      u.status === RunUploadStatus.ANALYZING ||
      u.status === RunUploadStatus.SAVING
  ).length;

  // In-progress percentage (one segment per active upload)
  const inProgressPercent =
    progress.totalUploads > 0
      ? (analyzingCount / progress.totalUploads) * 100
      : 0;

  const progressPercent = Math.round(completedPercent);

  const runStatusVariant =
    progress.status === RunStatus.SUCCEEDED
      ? "success"
      : progress.status === RunStatus.FAILED
        ? "destructive"
        : progress.status === RunStatus.RUNNING
          ? "info"
          : "muted";

  const phases = [
    { phase: RunPhase.INITIALIZING, label: "Initialize" },
    { phase: RunPhase.LOADING_CONTENT, label: "Load Documents" },
    { phase: RunPhase.ANALYZING, label: "AI Analysis" },
    { phase: RunPhase.SAVING_RESULTS, label: "Save Results" },
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
                <span>Analyzing Project</span>
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
                      : progress.status === RunStatus.FAILED
                        ? "Failed"
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
              {progress.completedUploads + progress.failedUploads} of{" "}
              {progress.totalUploads} documents processed
              {analyzingCount > 0 && (
                <span className="text-primary ml-1">
                  ({analyzingCount} analyzing)
                </span>
              )}
            </span>
            <span className="font-semibold text-primary">
              {progress.totalCards} cards extracted
            </span>
          </div>
          {/* Custom progress bar with completed (solid) + in-progress (striped) */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            {/* Completed segment (solid) */}
            <div
              className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
              style={{ width: `${completedPercent}%` }}
            />
            {/* In-progress segment (animated striped) */}
            {analyzingCount > 0 && (
              <div
                className="absolute top-0 h-full overflow-hidden transition-all duration-300"
                style={{
                  left: `${completedPercent}%`,
                  width: `${inProgressPercent}%`,
                }}
              >
                <div
                  className="h-full w-full animate-pulse"
                  style={{
                    background: `repeating-linear-gradient(
                      -45deg,
                      hsl(var(--primary)),
                      hsl(var(--primary)) 4px,
                      hsl(var(--primary) / 0.6) 4px,
                      hsl(var(--primary) / 0.6) 8px
                    )`,
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>
          {progress.estimatedRemainingMs && isActive && (
            <p className="text-xs text-muted-foreground text-right">
              ~{formatDuration(progress.estimatedRemainingMs)} remaining
            </p>
          )}
        </div>

        {/* Currently Processing Banner - shows during active processing */}
        {isActive && currentDoc && activeUpload && (
          <CurrentlyProcessingBanner
            currentDoc={currentDoc}
            elapsedSeconds={processingElapsed}
            activeStatus={activeUpload.status}
          />
        )}

        {/* Document List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Documents</h4>
          <ScrollArea className="h-[240px] pr-4">
            <div className="space-y-2">
              {progress.uploads.map((upload) => (
                <UploadTimelineItem key={upload.uploadId} upload={upload} />
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
            {progress.failedUploads > 0 && (
              <StatusPill variant="destructive">
                {progress.failedUploads} failed
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

            {isComplete && progress.failedUploads > 0 && (
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
                Retry Failed ({progress.failedUploads})
              </Button>
            )}

            {isComplete && progress.status === RunStatus.SUCCEEDED && (
              <Button size="sm" onClick={() => router.refresh()}>
                <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                View {progress.totalCards} Cards
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
