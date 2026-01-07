"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Loader2, AlertCircle, FileText, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Upload {
  id: string;
  filename: string | null;
  fileType: string;
  status: string;
  wordCount?: number | null;
}

interface AnalyzeProjectButtonProps {
  projectId: string;
  uploads: Upload[];
  hasActiveRun?: boolean;
  existingCardCount?: number;
}

export function AnalyzeProjectButton({
  projectId,
  uploads,
  hasActiveRun = false,
  existingCardCount = 0,
}: AnalyzeProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(() =>
    new Set(uploads.filter((u) => u.status === "COMPLETED").map((u) => u.id))
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const completedUploads = uploads.filter((u) => u.status === "COMPLETED");
  const pendingUploads = uploads.filter((u) => u.status === "PENDING" || u.status === "PROCESSING");
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

  const getTooltipMessage = () => {
    if (hasActiveRun) return "An analysis is already in progress";
    if (hasNoUploads) return "Upload content first to analyze";
    if (hasNothingToAnalyze) return "No completed uploads to analyze";
    return undefined;
  };

  const handleToggleUpload = useCallback((uploadId: string) => {
    setSelectedUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedUploads(new Set(completedUploads.map((u) => u.id)));
  }, [completedUploads]);

  const handleSelectNone = useCallback(() => {
    setSelectedUploads(new Set());
  }, []);

  const handleAnalyze = async () => {
    if (selectedUploads.size === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setOpen(false);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadIds: Array.from(selectedUploads),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start analysis");
      }

      const result = await response.json();

      toast.success("Analysis started", {
        description: `Processing ${selectedUploads.size} upload(s)...`,
      });

      if (result.runId) {
        router.push(`/runs/${result.runId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start analysis";
      setError(message);
      toast.error("Analysis failed to start", { description: message });

      // Focus error for screen readers
      setTimeout(() => errorRef.current?.focus(), 100);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const tooltipMessage = getTooltipMessage();

  return (
    <>
      {error && (
        <Alert
          ref={errorRef}
          variant="destructive"
          className="mb-4"
          tabIndex={-1}
          role="alert"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={isDisabled}
            variant={existingCardCount > 0 ? "outline" : "default"}
            aria-busy={isAnalyzing}
            title={tooltipMessage}
          >
            {isAnalyzing || hasActiveRun ? (
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
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
                  <AlertCircle className="inline h-4 w-4 mr-1" aria-hidden="true" />
                  This will replace {existingCardCount} existing card{existingCardCount !== 1 ? "s" : ""}.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {hasNothingToAnalyze ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p>No completed uploads available for analysis.</p>
              {pendingUploads.length > 0 && (
                <p className="mt-2 text-sm">
                  {pendingUploads.length} upload{pendingUploads.length !== 1 ? "s" : ""} still processing...
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Selection controls */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {selectedUploads.size} of {completedUploads.length} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedUploads.size === completedUploads.length}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectNone}
                    disabled={selectedUploads.size === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-[300px] pr-4">
                <div
                  className="space-y-2"
                  role="group"
                  aria-label="Select uploads to analyze"
                >
                  {completedUploads.map((upload) => {
                    const isSelected = selectedUploads.has(upload.id);
                    return (
                      <button
                        key={upload.id}
                        type="button"
                        onClick={() => handleToggleUpload(upload.id)}
                        className={cn(
                          "flex items-start gap-3 w-full p-3 rounded-lg border text-left",
                          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent"
                        )}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? "Deselect" : "Select"} ${upload.filename || "Pasted text"}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                        )}
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
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={selectedUploads.size === 0 || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                  Start Analysis
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
