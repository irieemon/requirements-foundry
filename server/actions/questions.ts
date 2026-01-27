"use server";

import { db } from "@/lib/db";
import { getQuestionGenerator } from "@/lib/ai/question-generator";
import type { ExtractedContent } from "@/lib/documents/types";
import {
  type AIQuestion,
  type AIAnswer,
  type AIAnswersFormData,
  type UploadContextFormData,
  aiQuestionsArraySchema,
  uploadContextSchema,
} from "@/lib/uploads/context-schema";

// ============================================
// Question Status Types
// ============================================

export type QuestionStatus =
  | "no-context" // Context form not submitted yet
  | "pending-questions" // Context exists, questions not generated yet
  | "pending-answers" // Questions exist, answers not submitted yet
  | "complete"; // Both questions and answers exist

// ============================================
// Generate Questions for Upload
// ============================================

/**
 * Generate AI clarifying questions for an upload that has context.
 * Questions are generated based on document content + user-provided context.
 */
export async function generateQuestionsForUpload(uploadId: string): Promise<{
  success: boolean;
  questions?: AIQuestion[];
  error?: string;
}> {
  try {
    // 1. Fetch upload with context
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: {
        context: true,
        images: true,
      },
    });

    if (!upload) {
      return { success: false, error: "Upload not found" };
    }

    // 2. Check if context exists - questions require context form to be submitted first
    if (!upload.context) {
      return {
        success: false,
        error:
          "Context form must be submitted before generating questions. Please fill out the upload context form first.",
      };
    }

    // 3. If questions already generated, return existing questions
    if (upload.context.aiQuestions) {
      const existingQuestions = JSON.parse(upload.context.aiQuestions);
      const validated = aiQuestionsArraySchema.safeParse(existingQuestions);
      if (validated.success) {
        return { success: true, questions: validated.data };
      }
      // If existing questions are malformed, regenerate
    }

    // 4. Build ExtractedContent from upload data
    const documentContents: ExtractedContent[] = [];

    if (upload.rawContent) {
      documentContents.push({
        text: upload.rawContent,
        images: upload.images.map((img, index) => ({
          base64: img.base64,
          mimeType: img.mimeType,
          index,
          pageNumber: img.pageNumber ?? undefined,
          slideNumber: img.slideNumber ?? undefined,
          width: img.width ?? undefined,
          height: img.height ?? undefined,
          description: img.description ?? undefined,
        })),
        metadata: {
          filename: upload.filename || "Uploaded document",
          mimeType: upload.fileType,
          fileSize: upload.fileSize || 0,
          pageCount: upload.pageCount ?? undefined,
          slideCount: upload.slideCount ?? undefined,
          sheetCount: upload.sheetCount ?? undefined,
          wordCount: upload.wordCount || 0,
          extractionMethod: upload.processingMethod || "unknown",
          processingTimeMs: upload.processingTimeMs || 0,
          hasImages: upload.hasImages,
        },
      });
    }

    if (documentContents.length === 0 || !documentContents[0].text) {
      return {
        success: false,
        error: "No document content available for analysis",
      };
    }

    // 5. Parse user context from UploadContext model
    const userContext: UploadContextFormData = {
      projectType: upload.context.projectType as UploadContextFormData["projectType"],
      businessDomain: upload.context.businessDomain ?? undefined,
      targetAudience: upload.context.targetAudience ?? undefined,
      documentType: upload.context.documentType as UploadContextFormData["documentType"],
      confidentiality: upload.context.confidentiality as UploadContextFormData["confidentiality"],
      sourceSystem: upload.context.sourceSystem ?? undefined,
      notes: upload.context.notes ?? undefined,
      keyTerms: upload.context.keyTerms ?? undefined,
    };

    // Validate context matches schema (optional fields may be undefined)
    const contextValidation = uploadContextSchema.safeParse(userContext);
    const validatedContext = contextValidation.success ? contextValidation.data : null;

    // 6. Call question generator
    const generator = getQuestionGenerator();
    const result = await generator.generateQuestions(
      documentContents,
      validatedContext,
      { maxQuestions: 5 }
    );

    if (!result.success || !result.questions) {
      return {
        success: false,
        error: result.error || "Failed to generate questions",
      };
    }

    // 7. Store questions JSON in UploadContext
    await db.uploadContext.update({
      where: { id: upload.context.id },
      data: {
        aiQuestions: JSON.stringify(result.questions),
        questionsGeneratedAt: new Date(),
      },
    });

    return { success: true, questions: result.questions };
  } catch (error) {
    console.error("Error generating questions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Submit Question Answers
// ============================================

/**
 * Submit user answers for a set of AI-generated questions.
 */
export async function submitQuestionAnswers(
  uploadId: string,
  answersData: AIAnswersFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch upload context
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: { context: true },
    });

    if (!upload) {
      return { success: false, error: "Upload not found" };
    }

    if (!upload.context) {
      return { success: false, error: "Upload context not found" };
    }

    if (!upload.context.aiQuestions) {
      return {
        success: false,
        error: "No questions have been generated yet",
      };
    }

    // 2. Parse existing questions
    const existingQuestions: AIQuestion[] = JSON.parse(
      upload.context.aiQuestions
    );
    const questionIds = new Set(existingQuestions.map((q) => q.id));

    // 3. Validate answers match existing questions
    for (const answer of answersData.answers) {
      if (!questionIds.has(answer.questionId)) {
        return {
          success: false,
          error: `Answer references unknown question ID: ${answer.questionId}`,
        };
      }
    }

    // 4. Store answers JSON in UploadContext
    await db.uploadContext.update({
      where: { id: upload.context.id },
      data: {
        aiAnswers: JSON.stringify(answersData.answers),
        answersSubmittedAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error submitting answers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Get Questions for Upload
// ============================================

/**
 * Get questions and answers status for an upload.
 */
export async function getQuestionsForUpload(uploadId: string): Promise<{
  questions: AIQuestion[] | null;
  answers: AIAnswer[] | null;
  status: QuestionStatus;
}> {
  try {
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: { context: true },
    });

    if (!upload) {
      return { questions: null, answers: null, status: "no-context" };
    }

    // No context form submitted yet
    if (!upload.context) {
      return { questions: null, answers: null, status: "no-context" };
    }

    // Context exists but no questions generated
    if (!upload.context.aiQuestions) {
      return { questions: null, answers: null, status: "pending-questions" };
    }

    // Parse questions
    let questions: AIQuestion[] | null = null;
    try {
      const parsed = JSON.parse(upload.context.aiQuestions);
      const validated = aiQuestionsArraySchema.safeParse(parsed);
      questions = validated.success ? validated.data : null;
    } catch {
      // Questions exist but are malformed
      return { questions: null, answers: null, status: "pending-questions" };
    }

    // Questions exist but no answers
    if (!upload.context.aiAnswers) {
      return { questions, answers: null, status: "pending-answers" };
    }

    // Parse answers
    let answers: AIAnswer[] | null = null;
    try {
      answers = JSON.parse(upload.context.aiAnswers) as AIAnswer[];
    } catch {
      // Answers exist but are malformed
      return { questions, answers: null, status: "pending-answers" };
    }

    // Both questions and answers exist
    return { questions, answers, status: "complete" };
  } catch (error) {
    console.error("Error getting questions:", error);
    return { questions: null, answers: null, status: "no-context" };
  }
}
