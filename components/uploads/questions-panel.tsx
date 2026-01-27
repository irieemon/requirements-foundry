"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Sparkles,
  MessageCircleQuestion,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { AIQuestionsForm } from "./ai-questions-form";
import {
  generateQuestionsForUpload,
  getQuestionsForUpload,
  type QuestionStatus,
} from "@/server/actions/questions";
import type { AIQuestion, AIAnswer } from "@/lib/uploads/context-schema";

// ============================================
// Types
// ============================================

interface QuestionsPanelProps {
  uploadId: string;
  uploadFilename: string;
  hasContext: boolean;
  onComplete: () => void; // Called when questions answered or skipped
  onSkip: () => void; // User skips the entire questions step
}

type PanelState =
  | "loading" // Initial state, fetching status
  | "no-context" // Context form not submitted
  | "generate-prompt" // Ready to generate questions
  | "generating" // AI generating questions
  | "pending-answers" // Questions ready, awaiting answers
  | "complete" // Answers submitted
  | "error"; // Error state

// ============================================
// Main Component
// ============================================

export function QuestionsPanel({
  uploadId,
  uploadFilename,
  hasContext,
  onComplete,
  onSkip,
}: QuestionsPanelProps) {
  const [state, setState] = useState<PanelState>("loading");
  const [questions, setQuestions] = useState<AIQuestion[] | null>(null);
  const [answers, setAnswers] = useState<AIAnswer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current question status
  const fetchStatus = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const result = await getQuestionsForUpload(uploadId);

      setQuestions(result.questions);
      setAnswers(result.answers);

      // Map QuestionStatus to PanelState
      const statusToState: Record<QuestionStatus, PanelState> = {
        "no-context": "no-context",
        "pending-questions": "generate-prompt",
        "pending-answers": "pending-answers",
        "complete": "complete",
      };

      setState(statusToState[result.status]);
    } catch (err) {
      setError("Failed to load question status");
      setState("error");
    }
  }, [uploadId]);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle generate questions
  const handleGenerate = async () => {
    setState("generating");
    setError(null);

    try {
      const result = await generateQuestionsForUpload(uploadId);

      if (result.success && result.questions) {
        setQuestions(result.questions);
        setState("pending-answers");
        toast.success(`Generated ${result.questions.length} questions`);
      } else {
        setError(result.error || "Failed to generate questions");
        setState("error");
        toast.error(result.error || "Failed to generate questions");
      }
    } catch (err) {
      setError("Failed to generate questions");
      setState("error");
      toast.error("Failed to generate questions");
    }
  };

  // Handle answers submitted
  const handleAnswersSubmitted = () => {
    setState("complete");
    onComplete();
  };

  // Handle skip
  const handleSkip = () => {
    onSkip();
  };

  // ============================================
  // Render States
  // ============================================

  // Loading
  if (state === "loading") {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No context - can't generate questions
  if (state === "no-context" || !hasContext) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Info className="h-5 w-5 text-muted-foreground" />
            <span>Context Required</span>
          </CardTitle>
          <CardDescription>
            To generate AI clarifying questions, please provide context about
            your upload first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-end">
            <Button variant="ghost" onClick={handleSkip}>
              Skip Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate prompt
  if (state === "generate-prompt") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Generate Questions</span>
          </CardTitle>
          <CardDescription>
            AI will review <strong>{uploadFilename}</strong> and your context to
            generate targeted clarifying questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Questions help produce better requirements.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleGenerate}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Questions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generating
  if (state === "generating") {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <Sparkles className="h-8 w-8 text-primary" />
              <Loader2 className="h-8 w-8 animate-spin absolute top-0 left-0 text-primary/30" />
            </div>
            <div className="text-center">
              <p className="font-medium">Generating questions...</p>
              <p className="text-sm text-muted-foreground">
                AI is reviewing your document and context
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending answers - show form
  if (state === "pending-answers" && questions) {
    return (
      <AIQuestionsForm
        uploadId={uploadId}
        questions={questions}
        existingAnswers={answers || undefined}
        onSubmit={handleAnswersSubmitted}
        onSkip={handleSkip}
      />
    );
  }

  // Complete
  if (state === "complete") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Questions Complete</span>
          </CardTitle>
          <CardDescription>
            Your answers have been recorded and will be used to improve
            requirements generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {questions?.length || 0} question{questions?.length !== 1 ? "s" : ""}{" "}
              answered
            </div>
            <Button variant="outline" onClick={() => setState("pending-answers")}>
              <MessageCircleQuestion className="mr-2 h-4 w-4" />
              Edit Answers
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error
  if (state === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>Error</span>
          </CardTitle>
          <CardDescription>{error || "Something went wrong"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={fetchStatus}>
              Retry
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Skip Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback
  return null;
}
