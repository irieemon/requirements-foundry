"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageCircleQuestion, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { z } from "zod";
import {
  type AIQuestion,
  type AIAnswer,
  QUESTION_CATEGORY_LABELS,
} from "@/lib/uploads/context-schema";
import { submitQuestionAnswers } from "@/server/actions/questions";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface AIQuestionsFormProps {
  uploadId: string;
  questions: AIQuestion[];
  existingAnswers?: AIAnswer[];
  onSubmit: () => void;
  onSkip?: () => void;
}

// Dynamic form schema based on questions
function createFormSchema(questions: AIQuestion[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const q of questions) {
    shape[q.id] = z.string().min(1, "Please provide an answer");
  }
  return z.object(shape);
}

// Category colors for badges
const CATEGORY_COLORS: Record<string, string> = {
  scope: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  users: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  constraints: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  integration: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  priority: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

// Importance indicator
function ImportanceIndicator({ importance }: { importance: "high" | "medium" | "low" }) {
  const colors = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-gray-400",
  };

  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full", colors[importance])}
      title={`${importance} importance`}
    />
  );
}

// ============================================
// Main Component
// ============================================

export function AIQuestionsForm({
  uploadId,
  questions,
  existingAnswers,
  onSubmit,
  onSkip,
}: AIQuestionsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build default values from existing answers
  const defaultValues: Record<string, string> = {};
  for (const q of questions) {
    const existing = existingAnswers?.find((a) => a.questionId === q.id);
    defaultValues[q.id] = existing?.answer || "";
  }

  const formSchema = createFormSchema(questions);
  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const handleSubmit = async (data: FormValues) => {
    setIsSubmitting(true);

    try {
      // Convert form data to answers array
      const answers = questions.map((q) => ({
        questionId: q.id,
        answer: data[q.id] || "",
      }));

      const result = await submitQuestionAnswers(uploadId, { answers });

      if (result.success) {
        toast.success("Answers submitted successfully");
        onSubmit();
      } else {
        toast.error(result.error || "Failed to submit answers");
      }
    } catch (error) {
      toast.error("Failed to submit answers");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <CheckCircle className="h-5 w-5" />
            <span>No questions generated</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <MessageCircleQuestion className="h-5 w-5 text-primary" />
          <span>AI Clarifying Questions</span>
        </CardTitle>
        <CardDescription>
          Answer these questions to help the AI generate better requirements.
          The more context you provide, the better the results.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    question.importance === "high" && "border-primary/50 bg-primary/5"
                  )}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Q{index + 1}
                      </span>
                      <ImportanceIndicator importance={question.importance} />
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", CATEGORY_COLORS[question.category])}
                    >
                      {QUESTION_CATEGORY_LABELS[question.category]}
                    </Badge>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-medium mb-2">{question.question}</p>

                  {/* Context Note */}
                  {question.context && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {question.context}
                    </p>
                  )}

                  {/* Answer Input */}
                  <FormField
                    control={form.control}
                    name={question.id}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Answer for question {index + 1}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Your answer..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              {onSkip && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Skip Questions
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Submit Answers
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
