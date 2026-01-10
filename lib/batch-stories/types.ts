/**
 * Types for Generate ALL Stories feature
 *
 * This feature processes all epics in a project sequentially,
 * generating stories for each with progress tracking and retry support.
 */

import type { GenerationMode, PersonaSet, RunStatus } from "@/lib/types";

// ============================================
// Run Configuration
// ============================================

/**
 * Pacing options for API calls to prevent rate limiting
 */
export const PacingMode = {
  FAST: "fast",
  SAFE: "safe",
} as const;
export type PacingMode = (typeof PacingMode)[keyof typeof PacingMode];

/**
 * How to handle epics that already have stories
 */
export const ExistingStoriesMode = {
  SKIP: "skip",
  REPLACE: "replace",
} as const;
export type ExistingStoriesMode =
  (typeof ExistingStoriesMode)[keyof typeof ExistingStoriesMode];

/**
 * Configuration for a batch story generation run
 */
export interface BatchStoryConfig {
  projectId: string;
  mode: GenerationMode;
  personaSet: PersonaSet;
  pacing: PacingMode;
  existingStoriesMode: ExistingStoriesMode;
  epicIds?: string[]; // Optional: subset of epics (for retry)
}

// ============================================
// Per-Epic Status (RunEpic)
// ============================================

/**
 * Status for individual epic processing within a run
 */
export const RunEpicStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type RunEpicStatus = (typeof RunEpicStatus)[keyof typeof RunEpicStatus];

/**
 * Progress info for a single epic within the batch run
 */
export interface RunEpicProgress {
  epicId: string;
  epicCode: string;
  epicTitle: string;
  status: RunEpicStatus;
  storiesCreated: number;
  storiesDeleted: number;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
}

// ============================================
// Run Progress
// ============================================

/**
 * Overall progress for the batch run
 */
export interface BatchStoryProgress {
  runId: string;
  status: RunStatus;
  phase: BatchStoryPhase;
  phaseDetail?: string;

  // Counters
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
  skippedEpics: number;
  totalStories: number;

  // Per-epic details
  epics: RunEpicProgress[];

  // Timing
  startedAt?: Date;
  elapsedMs?: number;
  estimatedRemainingMs?: number;

  // Errors
  error?: string;
}

/**
 * Processing phases for batch story generation
 */
export const BatchStoryPhase = {
  INITIALIZING: "INITIALIZING",
  VALIDATING: "VALIDATING",
  PROCESSING: "PROCESSING",
  FINALIZING: "FINALIZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type BatchStoryPhase =
  (typeof BatchStoryPhase)[keyof typeof BatchStoryPhase];

// ============================================
// API Input/Output
// ============================================

/**
 * Input for starting a batch story generation
 */
export interface GenerateAllStoriesInput {
  projectId: string;
  mode?: GenerationMode; // Default: standard
  personaSet?: PersonaSet; // Default: core
  pacing?: PacingMode; // Default: safe
  existingStoriesMode?: ExistingStoriesMode; // Default: skip
}

/**
 * Result of starting a batch story generation
 */
export interface GenerateAllStoriesResult {
  success: boolean;
  runId?: string;
  error?: string;
}

/**
 * Input for retrying failed epics
 */
export interface RetryFailedEpicsInput {
  runId: string;
  epicIds?: string[]; // Optional: specific epics to retry
}

/**
 * Result of retry operation
 */
export interface RetryFailedEpicsResult {
  success: boolean;
  newRunId?: string;
  error?: string;
}

// ============================================
// Pacing Configuration
// ============================================

/**
 * Pacing delay configuration
 */
export const PACING_CONFIG = {
  fast: {
    delayBetweenEpicsMs: 500,
    delayAfterErrorMs: 2000,
    maxRetries: 1,
    description: "Faster processing, higher rate limit risk",
  },
  safe: {
    delayBetweenEpicsMs: 2000,
    delayAfterErrorMs: 5000,
    maxRetries: 2,
    description: "Slower processing, lower rate limit risk",
  },
} as const;

// ============================================
// Error Types
// ============================================

/**
 * Specific error types for better handling
 */
export const BatchStoryErrorType = {
  NO_EPICS: "NO_EPICS",
  RUN_IN_PROGRESS: "RUN_IN_PROGRESS",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  API_ERROR: "API_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const;
export type BatchStoryErrorType =
  (typeof BatchStoryErrorType)[keyof typeof BatchStoryErrorType];

/**
 * Structured error for batch story operations
 */
export interface BatchStoryError {
  type: BatchStoryErrorType;
  message: string;
  epicId?: string;
  retryable: boolean;
}

// ============================================
// Database Types (Prisma extension)
// ============================================

/**
 * Type for RunEpic junction table
 * Links Run to Epic for batch processing
 */
export interface RunEpicRecord {
  id: string;
  runId: string;
  epicId: string;
  status: RunEpicStatus;
  order: number;
  storiesCreated: number;
  storiesDeleted: number;
  tokensUsed: number;
  durationMs: number | null;
  errorMsg: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// ============================================
// UI Component Props
// ============================================

/**
 * Props for the Generate ALL Stories button/form
 */
export interface GenerateAllStoriesFormProps {
  projectId: string;
  epicCount: number;
  epicsWithStories: number;
  onRunStarted?: (runId: string) => void;
  onRunCompleted?: (progress: BatchStoryProgress) => void;
}

/**
 * Props for the batch run progress display
 */
export interface BatchRunProgressProps {
  runId: string;
  onCancel?: () => void;
  onRetry?: (failedEpicIds: string[]) => void;
  pollingIntervalMs?: number;
}
