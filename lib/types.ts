// ============================================
// Enums (mirroring Prisma schema string values)
// ============================================

// Upload extraction status (tracks document extraction phase)
export const ExtractionStatus = {
  PENDING: "PENDING",
  EXTRACTING: "EXTRACTING",
  EXTRACTED: "EXTRACTED",
  FAILED: "FAILED",
} as const;
export type ExtractionStatus = (typeof ExtractionStatus)[keyof typeof ExtractionStatus];

// Upload analysis status (tracks whether upload has been analyzed for cards)
export const AnalysisStatus = {
  PENDING: "PENDING",
  QUEUED: "QUEUED",
  ANALYZING: "ANALYZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type AnalysisStatus = (typeof AnalysisStatus)[keyof typeof AnalysisStatus];

// Legacy UploadStatus for backward compatibility during migration
export const UploadStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

export const RunType = {
  ANALYZE_CARDS: "ANALYZE_CARDS",
  GENERATE_EPICS: "GENERATE_EPICS",
  GENERATE_STORIES: "GENERATE_STORIES",
  GENERATE_ALL_STORIES: "GENERATE_ALL_STORIES",
  EXPORT: "EXPORT",
} as const;
export type RunType = (typeof RunType)[keyof typeof RunType];

export const RunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  PARTIAL: "PARTIAL",  // Some items succeeded, some failed
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

// Run phase (granular phase tracking within a run)
export const RunPhase = {
  INITIALIZING: "INITIALIZING",
  LOADING_CONTENT: "LOADING_CONTENT",
  ANALYZING: "ANALYZING",
  QUEUEING_EPICS: "QUEUEING_EPICS",        // For batch story generation
  GENERATING_STORIES: "GENERATING_STORIES", // For batch story generation
  SAVING_RESULTS: "SAVING_RESULTS",
  FINALIZING: "FINALIZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type RunPhase = (typeof RunPhase)[keyof typeof RunPhase];

// Per-upload status within a run
export const RunUploadStatus = {
  PENDING: "PENDING",
  LOADING: "LOADING",
  ANALYZING: "ANALYZING",
  SAVING: "SAVING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type RunUploadStatus = (typeof RunUploadStatus)[keyof typeof RunUploadStatus];

// Per-epic status within a batch story generation run
export const RunEpicStatus = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  SAVING: "SAVING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type RunEpicStatus = (typeof RunEpicStatus)[keyof typeof RunEpicStatus];

// Batch story generation: how to handle epics that already have stories
export const ExistingStoriesBehavior = {
  REPLACE: "replace",  // Delete existing stories and regenerate
  SKIP: "skip",        // Skip epics that have stories
} as const;
export type ExistingStoriesBehavior = (typeof ExistingStoriesBehavior)[keyof typeof ExistingStoriesBehavior];

// Batch story generation: processing pacing
export const ProcessingPacing = {
  SAFE: "safe",     // 2s delay, best for large batches
  NORMAL: "normal", // 1s delay, balanced
  FAST: "fast",     // 0.5s delay, may hit rate limits
} as const;
export type ProcessingPacing = (typeof ProcessingPacing)[keyof typeof ProcessingPacing];

// Pacing configuration
export const PACING_CONFIG = {
  safe: {
    delayBetweenEpicsMs: 2000,
    maxRetries: 3,
    retryBackoffMs: [5000, 10000, 20000],
  },
  normal: {
    delayBetweenEpicsMs: 1000,
    maxRetries: 3,
    retryBackoffMs: [3000, 6000, 12000],
  },
  fast: {
    delayBetweenEpicsMs: 500,
    maxRetries: 2,
    retryBackoffMs: [2000, 4000],
  },
} as const;

// ============================================
// Generation Modes & Personas
// ============================================

export const GenerationMode = {
  COMPACT: "compact",
  STANDARD: "standard",
  DETAILED: "detailed",
} as const;
export type GenerationMode = (typeof GenerationMode)[keyof typeof GenerationMode];

export const PersonaSet = {
  LIGHTWEIGHT: "lightweight",
  CORE: "core",
  FULL: "full",
} as const;
export type PersonaSet = (typeof PersonaSet)[keyof typeof PersonaSet];

export const GENERATION_MODE_CONFIG = {
  compact: {
    storyCount: { min: 5, max: 8 },
    focus: "Core user journeys only, happy paths",
    includeEdgeCases: false,
    includeAltFlows: false,
  },
  standard: {
    storyCount: { min: 8, max: 12 },
    focus: "Complete feature coverage with primary edge cases",
    includeEdgeCases: true,
    includeAltFlows: false,
  },
  detailed: {
    storyCount: { min: 12, max: 15 },
    focus: "Exhaustive coverage including edge cases, error states, and alternative flows",
    includeEdgeCases: true,
    includeAltFlows: true,
  },
} as const;

export const PERSONA_SETS = {
  lightweight: ["End User", "Administrator", "System"],
  core: ["End User", "Administrator", "System", "Product Owner", "Developer"],
  full: [
    "End User",
    "Administrator",
    "System",
    "Product Owner",
    "Developer",
    "QA Engineer",
    "Security Analyst",
    "Support Agent",
    "Operations",
  ],
} as const;

// ============================================
// Card Schema (normalized from uploads)
// ============================================

export interface CardData {
  title: string;
  problem?: string;
  targetUsers?: string;
  currentState?: string;
  desiredOutcomes?: string;
  constraints?: string;
  systems?: string;
  priority?: string;
  impact?: string;
  rawText?: string;
}

// ============================================
// Epic Schema (generated)
// ============================================

export interface EpicData {
  code: string;
  title: string;
  theme?: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  effort?: string;
  impact?: string;
  priority?: number;
  cardIds?: string[];
}

// ============================================
// Story Schema (generated)
// ============================================

export interface StoryData {
  code: string;
  title: string;
  userStory: string;
  persona?: string;
  acceptanceCriteria?: string[];
  technicalNotes?: string;
  priority?: string;
  effort?: string;
}

// ============================================
// Subtask Schema
// ============================================

export interface SubtaskData {
  code: string;
  title: string;
  description?: string;
  effort?: string;
}

// ============================================
// Generation Input/Output Types
// ============================================

export interface GenerateEpicsInput {
  projectId: string;
  cardIds?: string[];
}

export interface GenerateStoriesInput {
  epicId: string;
  mode: GenerationMode;
  personaSet: PersonaSet;
}

export interface GenerationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
}

// ============================================
// Analysis Run Types
// ============================================

export interface AnalyzeProjectInput {
  projectId: string;
  uploadIds?: string[];  // Optional: specific uploads. If omitted, all PENDING uploads
  options?: {
    replaceExisting?: boolean;  // Replace cards from previous analysis
    maxCardsPerUpload?: number; // Limit cards per document
  };
}

export interface AnalyzeProjectResult {
  success: boolean;
  runId?: string;
  error?: string;
}

export interface RunUploadProgress {
  uploadId: string;
  filename: string;
  status: RunUploadStatus;
  cardsCreated: number;
  error?: string;
  durationMs?: number;
}

export interface RunProgress {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  phaseDetail?: string;

  // Counters
  totalUploads: number;
  completedUploads: number;
  failedUploads: number;
  totalCards: number;

  // Per-upload details
  uploads: RunUploadProgress[];

  // Timing
  startedAt?: Date;
  elapsedMs?: number;
  estimatedRemainingMs?: number;

  // Errors
  error?: string;
}

// ============================================
// Batch Story Generation Types
// ============================================

export interface GenerateAllStoriesInput {
  projectId: string;
  options: {
    mode: GenerationMode;
    personaSet: PersonaSet;
    existingStoriesBehavior: ExistingStoriesBehavior;
    epicIds?: string[];  // Optional: specific epics only (for retry)
    pacing: ProcessingPacing;
  };
}

export interface GenerateAllStoriesResult {
  success: boolean;
  runId?: string;
  error?: string;
  epicCount?: number;
}

export interface RunEpicProgress {
  epicId: string;
  epicCode: string;
  epicTitle: string;
  status: RunEpicStatus;
  storiesCreated: number;
  storiesDeleted: number;
  error?: string;
  durationMs?: number;
}

export interface BatchStoryProgress {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  phaseDetail?: string;

  // Counters
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
  skippedEpics: number;
  totalStoriesCreated: number;

  // Current processing
  currentEpicIndex?: number;  // 1-based
  currentEpicId?: string;
  currentEpicTitle?: string;

  // Epic details
  epics: RunEpicProgress[];

  // Timing
  startedAt?: Date;
  elapsedMs?: number;
  estimatedRemainingMs?: number;

  // Error
  error?: string;
}

// ============================================
// Export Types
// ============================================

export interface JiraExportRow {
  "Issue Type": string;
  Summary: string;
  Description: string;
  "Epic Link"?: string;
  Priority?: string;
  Labels?: string;
  "Story Points"?: string;
  "Acceptance Criteria"?: string;
}

export interface ExportOptions {
  includeEpics: boolean;
  includeStories: boolean;
  includeSubtasks: boolean;
  format: "csv" | "json";
}
