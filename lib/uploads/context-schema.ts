import { z } from "zod";

// ============================================
// Upload Context Schema
// User-provided metadata during document upload
// ============================================

export const PROJECT_TYPES = [
  "new-development",
  "enhancement",
  "migration",
  "maintenance",
  "other",
] as const;

export const DOCUMENT_TYPES = [
  "requirements",
  "design",
  "meeting-notes",
  "analysis",
  "specification",
  "other",
] as const;

export const CONFIDENTIALITY_LEVELS = [
  "public",
  "internal",
  "confidential",
] as const;

export const uploadContextSchema = z.object({
  // Project Basics
  projectType: z.enum(PROJECT_TYPES).optional(),
  businessDomain: z.string().max(100).optional(),
  targetAudience: z.string().max(500).optional(),

  // Document Classification
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  confidentiality: z.enum(CONFIDENTIALITY_LEVELS).optional(),
  sourceSystem: z.string().max(100).optional(),

  // Freeform
  notes: z.string().max(2000).optional(),
  keyTerms: z.string().max(500).optional(),
});

export type UploadContextFormData = z.infer<typeof uploadContextSchema>;

// Display labels for select options
export const PROJECT_TYPE_LABELS: Record<typeof PROJECT_TYPES[number], string> = {
  "new-development": "New Development",
  "enhancement": "Enhancement",
  "migration": "Migration",
  "maintenance": "Maintenance",
  "other": "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<typeof DOCUMENT_TYPES[number], string> = {
  "requirements": "Requirements",
  "design": "Design",
  "meeting-notes": "Meeting Notes",
  "analysis": "Analysis",
  "specification": "Specification",
  "other": "Other",
};

export const CONFIDENTIALITY_LABELS: Record<typeof CONFIDENTIALITY_LEVELS[number], string> = {
  "public": "Public",
  "internal": "Internal",
  "confidential": "Confidential",
};

// ============================================
// AI Question Generation Schemas
// ============================================

export const QUESTION_CATEGORIES = [
  "scope",
  "users",
  "constraints",
  "integration",
  "priority",
  "other",
] as const;

export const QUESTION_IMPORTANCE = ["high", "medium", "low"] as const;

// Question structure from AI
export const aiQuestionSchema = z.object({
  id: z.string(), // q1, q2, etc.
  question: z.string(), // The question text
  category: z.enum(QUESTION_CATEGORIES),
  importance: z.enum(QUESTION_IMPORTANCE),
  context: z.string().optional(), // Why this question matters
});

export type AIQuestion = z.infer<typeof aiQuestionSchema>;

// Array of questions for validation
export const aiQuestionsArraySchema = z.array(aiQuestionSchema);

// Answer structure from user
export const aiAnswerSchema = z.object({
  questionId: z.string(), // Matches aiQuestionSchema.id
  answer: z.string(), // User's response
});

export type AIAnswer = z.infer<typeof aiAnswerSchema>;

// For form validation
export const aiAnswersFormSchema = z.object({
  answers: z.array(aiAnswerSchema),
});

export type AIAnswersFormData = z.infer<typeof aiAnswersFormSchema>;

// Display labels for question categories
export const QUESTION_CATEGORY_LABELS: Record<typeof QUESTION_CATEGORIES[number], string> = {
  "scope": "Scope",
  "users": "Users",
  "constraints": "Constraints",
  "integration": "Integration",
  "priority": "Priority",
  "other": "Other",
};
