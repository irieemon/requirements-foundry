"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, FileText, AlertCircle, CheckCircle, MessageCircleQuestion, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { RunProgressPanel } from "./run-progress-panel";
import { useActiveRun } from "@/hooks/use-run-progress";
import { analyzeProject, getPendingUploadCount } from "@/server/actions/analysis";
import { getQuestionsForUpload, type QuestionStatus } from "@/server/actions/questions";
import { AnalysisStatus, ExtractionStatus } from "@/lib/types";
import { QuestionsPanel } from "@/components/uploads/questions-panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ============================================
// Types
// ============================================

interface Upload {
  id: string;
  filename: string | null;
  extractionStatus: string;
  analysisStatus: string;
  wordCount: number | null;
  hasImages: boolean;
  _count: { cards: number };
  context?: {
    id: string;
    aiQuestions: string | null;
    aiAnswers: string | null;
  } | null;
}

interface UploadQuestionStatus {
  uploadId: string;
  filename: string;
  hasContext: boolean;
  status: QuestionStatus;
}

interface AnalyzePanelProps {
  projectId: string;
  uploads: Upload[];
}

// ============================================
// Upload Selection Row
// ============================================

function UploadRow({
  upload,
  selected,
  onToggle,
}: {
  upload: Upload;
  selected: boolean;
  onToggle: () => void;
}) {
  const isPending =
    upload.extractionStatus === ExtractionStatus.EXTRACTED &&
    (upload.analysisStatus === AnalysisStatus.PENDING ||
      upload.analysisStatus === AnalysisStatus.FAILED);

  const isAnalyzed = upload.analysisStatus === AnalysisStatus.COMPLETED;
  const isFailed = upload.analysisStatus === AnalysisStatus.FAILED;

  return (
    <div
      className={`flex items-center space-x-3 p-2 rounded-lg border ${
        selected
          ? "bg-primary/5 border-primary/30"
          : "bg-muted/30 border-border"
      }`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        disabled={!isPending}
      />
      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{upload.filename || "Pasted text"}</p>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          {upload.wordCount && <span>{upload.wordCount.toLocaleString()} words</span>}
          {upload.hasImages && <span>• has images</span>}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {isAnalyzed && (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle className="h-3 w-3 mr-1" />
            {upload._count.cards} cards
          </Badge>
        )}
        {isFailed && (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )}
        {isPending && !isFailed && (
          <Badge variant="outline" className="text-xs">
            Pending
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function AnalyzePanel({ projectId, uploads }: AnalyzePanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // Questions integration
  const [uploadsWithPendingQuestions, setUploadsWithPendingQuestions] = useState<UploadQuestionStatus[]>([]);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [activeQuestionUploadId, setActiveQuestionUploadId] = useState<string | null>(null);

  // Check for any existing active run (with stale recovery detection)
  const { activeRunId, isChecking, recoveredFromStale, previousRunId } = useActiveRun(projectId);

  // Use active run if one exists
  useEffect(() => {
    if (activeRunId) {
      setCurrentRunId(activeRunId);
    }
  }, [activeRunId]);

  // Show toast if we recovered from a stale run
  useEffect(() => {
    if (recoveredFromStale && previousRunId) {
      toast.info("Recovered from stale run", {
        description: "A previous analysis was stuck and has been marked as failed. You can start a new analysis.",
      });
    }
  }, [recoveredFromStale, previousRunId]);

  // Check question status for uploads with context
  useEffect(() => {
    async function checkQuestionStatus() {
      const pendingQuestionUploads: UploadQuestionStatus[] = [];

      // Only check pending uploads that have context
      const uploadsToCheck = uploads.filter(
        (u) =>
          u.extractionStatus === ExtractionStatus.EXTRACTED &&
          (u.analysisStatus === AnalysisStatus.PENDING ||
            u.analysisStatus === AnalysisStatus.FAILED) &&
          u.context // Has context data
      );

      for (const upload of uploadsToCheck) {
        try {
          const result = await getQuestionsForUpload(upload.id);

          // Track uploads that have context and could benefit from questions
          // Status is pending-questions or pending-answers (not complete)
          if (result.status === "pending-questions" || result.status === "pending-answers") {
            pendingQuestionUploads.push({
              uploadId: upload.id,
              filename: upload.filename || "Uploaded file",
              hasContext: !!upload.context,
              status: result.status,
            });
          }
        } catch {
          // Ignore errors, just don't show questions panel
        }
      }

      setUploadsWithPendingQuestions(pendingQuestionUploads);

      // Auto-expand if there are pending questions
      if (pendingQuestionUploads.length > 0 && !questionsExpanded) {
        setQuestionsExpanded(true);
        // Set first upload as active if none selected
        if (!activeQuestionUploadId) {
          setActiveQuestionUploadId(pendingQuestionUploads[0].uploadId);
        }
      }
    }

    checkQuestionStatus();
  }, [uploads, questionsExpanded, activeQuestionUploadId]);

  // Filter to only show extracted uploads
  const extractedUploads = uploads.filter(
    (u) => u.extractionStatus === ExtractionStatus.EXTRACTED
  );

  // Pending uploads (not yet analyzed or failed)
  const pendingUploads = extractedUploads.filter(
    (u) =>
      u.analysisStatus === AnalysisStatus.PENDING ||
      u.analysisStatus === AnalysisStatus.FAILED
  );

  // Toggle selection
  const toggleUpload = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all pending
  const selectAllPending = () => {
    setSelectedIds(new Set(pendingUploads.map((u) => u.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Start analysis
  const handleAnalyze = async () => {
    const uploadIds = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;

    setIsAnalyzing(true);
    try {
      const result = await analyzeProject({
        projectId,
        uploadIds,
      });

      if (result.success && result.runId) {
        setCurrentRunId(result.runId);
        setSelectedIds(new Set());
        toast.success("Analysis started!");
      } else {
        toast.error(result.error || "Failed to start analysis");
      }
    } catch (err) {
      toast.error("Failed to start analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Close progress panel
  const handleCloseProgress = () => {
    setCurrentRunId(null);
  };

  // Handle question completion for an upload
  const handleQuestionComplete = (uploadId: string) => {
    setUploadsWithPendingQuestions((prev) =>
      prev.filter((u) => u.uploadId !== uploadId)
    );
    // Move to next upload if this was active
    if (activeQuestionUploadId === uploadId) {
      const remaining = uploadsWithPendingQuestions.filter((u) => u.uploadId !== uploadId);
      setActiveQuestionUploadId(remaining.length > 0 ? remaining[0].uploadId : null);
    }
  };

  // Handle question skip for an upload
  const handleQuestionSkip = (uploadId: string) => {
    setUploadsWithPendingQuestions((prev) =>
      prev.filter((u) => u.uploadId !== uploadId)
    );
    // Move to next upload if this was active
    if (activeQuestionUploadId === uploadId) {
      const remaining = uploadsWithPendingQuestions.filter((u) => u.uploadId !== uploadId);
      setActiveQuestionUploadId(remaining.length > 0 ? remaining[0].uploadId : null);
    }
  };

  // Show loading state while checking for active run
  if (isChecking) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Checking status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show progress panel if we have an active run
  if (currentRunId) {
    return (
      <RunProgressPanel
        runId={currentRunId}
        projectId={projectId}
        onClose={handleCloseProgress}
      />
    );
  }

  // No pending uploads
  if (pendingUploads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>AI Card Generation</span>
          </CardTitle>
          <CardDescription>
            All uploads have been analyzed. Upload more documents to generate additional cards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All documents analyzed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show analyze UI
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>AI Card Generation</span>
            </CardTitle>
            <CardDescription>
              {pendingUploads.length} document{pendingUploads.length !== 1 ? "s" : ""} ready for
              analysis. Select specific uploads or analyze all.
            </CardDescription>
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || pendingUploads.length === 0}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Questions Panel - show when uploads have pending questions */}
        {uploadsWithPendingQuestions.length > 0 && (
          <Collapsible open={questionsExpanded} onOpenChange={setQuestionsExpanded}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
              >
                {questionsExpanded ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
                <MessageCircleQuestion className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {uploadsWithPendingQuestions.length} upload
                  {uploadsWithPendingQuestions.length !== 1 ? "s" : ""} can benefit from clarifying questions
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  Optional
                </Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {/* Upload tabs if multiple */}
              {uploadsWithPendingQuestions.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {uploadsWithPendingQuestions.map((upload) => (
                    <Button
                      key={upload.uploadId}
                      variant={activeQuestionUploadId === upload.uploadId ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveQuestionUploadId(upload.uploadId)}
                      className="text-xs"
                    >
                      {upload.filename}
                      {upload.status === "pending-answers" && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          Has questions
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              )}

              {/* Active upload's questions panel */}
              {activeQuestionUploadId && (
                <QuestionsPanel
                  key={activeQuestionUploadId}
                  uploadId={activeQuestionUploadId}
                  uploadFilename={
                    uploadsWithPendingQuestions.find((u) => u.uploadId === activeQuestionUploadId)
                      ?.filename || "Upload"
                  }
                  hasContext={true}
                  onComplete={() => handleQuestionComplete(activeQuestionUploadId)}
                  onSkip={() => handleQuestionSkip(activeQuestionUploadId)}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Selection controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={selectAllPending}>
              Select All ({pendingUploads.length})
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Clear Selection
              </Button>
            )}
          </div>
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        {/* Upload list */}
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {extractedUploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                selected={selectedIds.has(upload.id)}
                onToggle={() => toggleUpload(upload.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
