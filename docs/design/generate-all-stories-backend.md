# Generate ALL Stories - Backend Design Document

## Overview

This document specifies the backend architecture for batch story generation across all epics in a project. The design prioritizes:
- **Fault tolerance**: Per-epic error isolation prevents cascade failures
- **Rate limiting**: Configurable pacing to avoid API throttling
- **Observability**: Real-time progress updates for UI responsiveness
- **Cancellation**: Graceful stop with state preservation

## 1. Database Schema Extensions

### 1.1 New RunType

Add to `lib/types.ts`:

```typescript
export const RunType = {
  ANALYZE_CARDS: "ANALYZE_CARDS",
  GENERATE_EPICS: "GENERATE_EPICS",
  GENERATE_STORIES: "GENERATE_STORIES",
  GENERATE_ALL_STORIES: "GENERATE_ALL_STORIES",  // NEW
  EXPORT: "EXPORT",
} as const;
```

### 1.2 New RunPhase Values

Add phases specific to batch story generation:

```typescript
export const RunPhase = {
  // Existing phases...
  INITIALIZING: "INITIALIZING",
  LOADING_CONTENT: "LOADING_CONTENT",
  ANALYZING: "ANALYZING",
  SAVING_RESULTS: "SAVING_RESULTS",
  FINALIZING: "FINALIZING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",

  // NEW phases for batch story generation
  QUEUEING_EPICS: "QUEUEING_EPICS",       // Creating RunEpic records
  GENERATING_STORIES: "GENERATING_STORIES", // Processing epics sequentially
} as const;
```

### 1.3 New RunEpic Model

Add to `prisma/schema.prisma`:

```prisma
// ============================================
// Run-Epic Junction
// Tracks per-epic progress within a GENERATE_ALL_STORIES run
// ============================================

model RunEpic {
  id        String   @id @default(cuid())
  runId     String
  run       Run      @relation(fields: [runId], references: [id], onDelete: Cascade)
  epicId    String
  epic      Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)

  // Per-epic status within this run
  status    String   @default("PENDING") // PENDING, GENERATING, COMPLETED, FAILED, SKIPPED

  // Processing metrics
  startedAt    DateTime?
  completedAt  DateTime?
  durationMs   Int?
  tokensUsed   Int?

  // Results
  storiesCreated Int      @default(0)
  errorMsg       String?

  // Ordering
  order        Int      @default(0)  // Processing order

  createdAt    DateTime @default(now())

  @@unique([runId, epicId])
  @@index([runId])
  @@index([epicId])
  @@index([runId, status])
}
```

Add relation to Epic model:

```prisma
model Epic {
  // ... existing fields ...
  runEpics RunEpic[]
}
```

Add relation to Run model:

```prisma
model Run {
  // ... existing fields ...
  runEpics RunEpic[]
}
```

### 1.4 New Status Enum

Add to `lib/types.ts`:

```typescript
// Per-epic status within a batch story generation run
export const RunEpicStatus = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",  // Used if epic has no cards or is excluded
} as const;
export type RunEpicStatus = (typeof RunEpicStatus)[keyof typeof RunEpicStatus];
```

---

## 2. Rate Limiting Configuration

### 2.1 Pacing Profiles

```typescript
// lib/run-engine/pacing.ts

export const PacingProfile = {
  SAFE: "safe",
  NORMAL: "normal",
  FAST: "fast",
} as const;
export type PacingProfile = (typeof PacingProfile)[keyof typeof PacingProfile];

export interface PacingConfig {
  delayBetweenEpicsMs: number;   // Wait time after each epic
  maxTokensPerRequest: number;   // Token limit for AI request
  maxConcurrentRequests: number; // Always 1 for sequential processing
  retryDelayMs: number;          // Wait before retry on rate limit
  maxRetries: number;            // Retry attempts per epic
}

export const PACING_CONFIGS: Record<PacingProfile, PacingConfig> = {
  safe: {
    delayBetweenEpicsMs: 3000,   // 3 seconds between epics
    maxTokensPerRequest: 2000,
    maxConcurrentRequests: 1,
    retryDelayMs: 10000,         // 10 second backoff
    maxRetries: 3,
  },
  normal: {
    delayBetweenEpicsMs: 1000,   // 1 second between epics
    maxTokensPerRequest: 4000,
    maxConcurrentRequests: 1,
    retryDelayMs: 5000,
    maxRetries: 2,
  },
  fast: {
    delayBetweenEpicsMs: 500,    // 500ms between epics
    maxTokensPerRequest: 4000,
    maxConcurrentRequests: 1,
    retryDelayMs: 3000,
    maxRetries: 2,
  },
};

export function getPacingConfig(profile: PacingProfile): PacingConfig {
  return PACING_CONFIGS[profile];
}
```

### 2.2 Adaptive Rate Limiting

```typescript
// lib/run-engine/rate-limiter.ts

export interface RateLimitState {
  consecutiveErrors: number;
  lastErrorTime: number | null;
  currentDelayMs: number;
}

export function createRateLimitState(baseDelayMs: number): RateLimitState {
  return {
    consecutiveErrors: 0,
    lastErrorTime: null,
    currentDelayMs: baseDelayMs,
  };
}

export function handleRateLimitError(state: RateLimitState): RateLimitState {
  const backoffMultiplier = Math.min(Math.pow(2, state.consecutiveErrors), 8);
  return {
    consecutiveErrors: state.consecutiveErrors + 1,
    lastErrorTime: Date.now(),
    currentDelayMs: state.currentDelayMs * backoffMultiplier,
  };
}

export function handleSuccess(state: RateLimitState, baseDelayMs: number): RateLimitState {
  return {
    consecutiveErrors: 0,
    lastErrorTime: null,
    currentDelayMs: baseDelayMs,
  };
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") ||
           msg.includes("429") ||
           msg.includes("too many requests");
  }
  return false;
}
```

---

## 3. Executor Implementation

### 3.1 Main Executor Function

```typescript
// lib/run-engine/story-executor.ts

import { db } from "@/lib/db";
import { getAIProvider, hasAnthropicKey } from "@/lib/ai/provider";
import {
  RunStatus,
  RunPhase,
  RunEpicStatus,
  GenerationMode,
  PersonaSet,
  EpicData,
} from "@/lib/types";
import {
  PacingProfile,
  getPacingConfig,
  PacingConfig,
} from "./pacing";
import {
  createRateLimitState,
  handleRateLimitError,
  handleSuccess,
  isRateLimitError,
  RateLimitState,
} from "./rate-limiter";

// Track active runs for cancellation (in-memory, per-process)
const activeStoryRuns = new Map<string, { cancelled: boolean }>();

export interface ExecuteGenerateAllStoriesOptions {
  runId: string;
  mode: GenerationMode;
  personaSet: PersonaSet;
  pacingProfile: PacingProfile;
  epicIds?: string[];  // Optional: specific epics. If omitted, all project epics
}

/**
 * Main executor for batch story generation.
 *
 * IMPORTANT: This function must be awaited (not fire-and-forget)
 * because Vercel serverless functions terminate when the response is sent.
 *
 * Flow:
 * 1. INITIALIZING: Load run, validate project has epics
 * 2. QUEUEING_EPICS: Create RunEpic records for tracking
 * 3. GENERATING_STORIES: Process each epic sequentially
 * 4. FINALIZING: Compute final stats, mark run complete
 */
export async function executeGenerateAllStories(
  options: ExecuteGenerateAllStoriesOptions
): Promise<void> {
  const { runId, mode, personaSet, pacingProfile, epicIds } = options;
  const context = { cancelled: false };
  activeStoryRuns.set(runId, context);

  const pacingConfig = getPacingConfig(pacingProfile);
  let rateLimitState = createRateLimitState(pacingConfig.delayBetweenEpicsMs);

  try {
    // ========================================
    // Phase 1: INITIALIZING
    // ========================================
    await updateRun(runId, {
      status: RunStatus.RUNNING,
      phase: RunPhase.INITIALIZING,
      startedAt: new Date(),
    });
    await appendLog(runId, "Starting batch story generation...");

    // Load run with project and epics
    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        project: {
          include: {
            epics: {
              orderBy: { priority: "asc" },
            },
          },
        },
      },
    });

    if (!run) {
      throw new Error("Run not found");
    }

    // Filter epics if specific IDs provided
    let epicsToProcess = run.project.epics;
    if (epicIds && epicIds.length > 0) {
      epicsToProcess = epicsToProcess.filter((e) => epicIds.includes(e.id));
    }

    if (epicsToProcess.length === 0) {
      throw new Error("No epics found to process");
    }

    // Check for cancellation
    if (context.cancelled) {
      await handleCancellation(runId);
      return;
    }

    // ========================================
    // Phase 2: QUEUEING_EPICS
    // ========================================
    await updateRun(runId, {
      phase: RunPhase.QUEUEING_EPICS,
      phaseDetail: `Preparing ${epicsToProcess.length} epics`,
      totalItems: epicsToProcess.length,
    });
    await appendLog(runId, `Queueing ${epicsToProcess.length} epics for processing`);

    // Create RunEpic records
    for (let i = 0; i < epicsToProcess.length; i++) {
      const epic = epicsToProcess[i];
      await db.runEpic.create({
        data: {
          runId,
          epicId: epic.id,
          status: RunEpicStatus.PENDING,
          order: i,
        },
      });
    }

    // ========================================
    // Phase 3: GENERATING_STORIES
    // ========================================
    await updateRun(runId, {
      phase: RunPhase.GENERATING_STORIES,
      phaseDetail: "Starting story generation",
    });

    const provider = getAIProvider();
    const isRealAI = hasAnthropicKey();
    await appendLog(runId, `Using ${isRealAI ? "Claude AI" : "Mock"} provider`);
    await appendLog(runId, `Mode: ${mode}, Personas: ${personaSet}, Pacing: ${pacingProfile}`);

    let totalStoriesCreated = 0;
    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < epicsToProcess.length; i++) {
      // Check cancellation before each epic
      if (context.cancelled) {
        await handleCancellation(runId);
        return;
      }

      const epic = epicsToProcess[i];
      const runEpic = await db.runEpic.findFirst({
        where: { runId, epicId: epic.id },
      });

      if (!runEpic) continue;

      const epicStartTime = Date.now();

      try {
        // Update RunEpic to GENERATING
        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.GENERATING,
          startedAt: new Date(),
        });

        // Update Run phaseDetail for UI
        await updateRun(runId, {
          phaseDetail: `Processing ${epic.code}: ${epic.title} (${i + 1}/${epicsToProcess.length})`,
        });

        await appendLog(runId, `[${epic.code}] Starting story generation...`);

        // Apply pacing delay (skip for first epic)
        if (i > 0) {
          await sleep(rateLimitState.currentDelayMs);
        }

        // Convert DB epic to EpicData
        const epicData: EpicData = {
          code: epic.code,
          title: epic.title,
          theme: epic.theme || undefined,
          description: epic.description || undefined,
          businessValue: epic.businessValue || undefined,
          acceptanceCriteria: epic.acceptanceCriteria
            ? JSON.parse(epic.acceptanceCriteria)
            : undefined,
          dependencies: epic.dependencies
            ? JSON.parse(epic.dependencies)
            : undefined,
          effort: epic.effort || undefined,
          impact: epic.impact || undefined,
          priority: epic.priority || undefined,
        };

        // Generate stories with retry logic
        const result = await generateWithRetry(
          provider,
          epicData,
          mode,
          personaSet,
          pacingConfig,
          rateLimitState
        );

        if (!result.success || !result.data) {
          throw new Error(result.error || "Story generation failed");
        }

        // Reset rate limit state on success
        rateLimitState = handleSuccess(rateLimitState, pacingConfig.delayBetweenEpicsMs);

        // Delete existing stories for this epic (regeneration)
        await db.story.deleteMany({ where: { epicId: epic.id } });

        // Create new stories
        for (const story of result.data) {
          await db.story.create({
            data: {
              epicId: epic.id,
              code: story.code,
              title: story.title,
              userStory: story.userStory,
              persona: story.persona || null,
              acceptanceCriteria: story.acceptanceCriteria
                ? JSON.stringify(story.acceptanceCriteria)
                : null,
              technicalNotes: story.technicalNotes || null,
              priority: story.priority || null,
              effort: story.effort || null,
              runId,
            },
          });
        }

        const storiesCreated = result.data.length;
        totalStoriesCreated += storiesCreated;
        completedCount++;

        const durationMs = Date.now() - epicStartTime;

        // Update RunEpic as completed
        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.COMPLETED,
          completedAt: new Date(),
          storiesCreated,
          tokensUsed: result.tokensUsed || 0,
          durationMs,
        });

        // Update Run counters immediately
        await db.run.update({
          where: { id: runId },
          data: {
            completedItems: completedCount,
            totalCards: totalStoriesCreated,  // Reusing totalCards for story count
          },
        });

        await appendLog(
          runId,
          `[${epic.code}] Completed: ${storiesCreated} stories (${durationMs}ms)`
        );

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        failedCount++;

        // Adjust rate limit state if it was a rate limit error
        if (isRateLimitError(error)) {
          rateLimitState = handleRateLimitError(rateLimitState);
          await appendLog(runId, `[${epic.code}] Rate limited, backing off to ${rateLimitState.currentDelayMs}ms`);
        }

        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.FAILED,
          completedAt: new Date(),
          errorMsg,
          durationMs: Date.now() - epicStartTime,
        });

        await db.run.update({
          where: { id: runId },
          data: { failedItems: failedCount },
        });

        await appendLog(runId, `[${epic.code}] FAILED: ${errorMsg}`);

        // Continue to next epic (per-epic error isolation)
      }
    }

    // ========================================
    // Phase 4: FINALIZING
    // ========================================
    if (!context.cancelled) {
      await updateRun(runId, {
        phase: RunPhase.FINALIZING,
        phaseDetail: "Computing final statistics",
      });

      const finalRun = await db.run.findUnique({ where: { id: runId } });
      const durationMs = finalRun?.startedAt
        ? Date.now() - finalRun.startedAt.getTime()
        : 0;

      // Determine final status
      const finalStatus = failedCount === epicsToProcess.length
        ? RunStatus.FAILED
        : RunStatus.SUCCEEDED;

      await updateRun(runId, {
        status: finalStatus,
        phase: RunPhase.COMPLETED,
        completedAt: new Date(),
        durationMs,
        phaseDetail: null,
        outputData: JSON.stringify({
          totalStories: totalStoriesCreated,
          processedEpics: completedCount,
          failedEpics: failedCount,
          mode,
          personaSet,
          pacingProfile,
        }),
      });

      const summaryMsg = `Completed: ${totalStoriesCreated} stories from ${completedCount} epics` +
        (failedCount > 0 ? ` (${failedCount} failed)` : "");
      await appendLog(runId, summaryMsg);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Run ${runId}] Fatal error:`, error);

    await updateRun(runId, {
      status: RunStatus.FAILED,
      phase: RunPhase.FAILED,
      completedAt: new Date(),
      errorMsg,
    });

    await appendLog(runId, `FATAL ERROR: ${errorMsg}`);
  } finally {
    activeStoryRuns.delete(runId);
  }
}

// ============================================
// Retry Logic with Rate Limit Handling
// ============================================

async function generateWithRetry(
  provider: ReturnType<typeof getAIProvider>,
  epicData: EpicData,
  mode: GenerationMode,
  personaSet: PersonaSet,
  config: PacingConfig,
  rateLimitState: RateLimitState
): Promise<ReturnType<typeof provider.generateStories>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await provider.generateStories(epicData, mode, personaSet);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRateLimitError(error) && attempt < config.maxRetries) {
        // Exponential backoff for rate limits
        const backoffMs = config.retryDelayMs * Math.pow(2, attempt);
        await sleep(backoffMs);
        continue;
      }

      // Non-retryable error or max retries exceeded
      throw lastError;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

// ============================================
// Cancellation Handling
// ============================================

export function markStoryRunCancelled(runId: string): boolean {
  const context = activeStoryRuns.get(runId);
  if (context) {
    context.cancelled = true;
    return true;
  }
  return false;
}

export function isStoryRunActive(runId: string): boolean {
  return activeStoryRuns.has(runId);
}

async function handleCancellation(runId: string): Promise<void> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { runEpics: true },
  });

  if (!run) return;

  // Leave PENDING RunEpics as PENDING (not SKIPPED) for potential retry
  // Only update run status
  await updateRun(runId, {
    status: RunStatus.CANCELLED,
    completedAt: new Date(),
    durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
  });

  await appendLog(runId, "Run cancelled by user");
}

// ============================================
// Helper Functions
// ============================================

async function updateRun(
  runId: string,
  data: {
    status?: string;
    phase?: string;
    phaseDetail?: string | null;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number | null;
    errorMsg?: string;
    outputData?: string;
    completedItems?: number;
    failedItems?: number;
    totalItems?: number;
    totalCards?: number;
  }
): Promise<void> {
  await db.run.update({ where: { id: runId }, data });
}

async function updateRunEpic(
  id: string,
  data: {
    status?: string;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    tokensUsed?: number;
    storiesCreated?: number;
    errorMsg?: string;
  }
): Promise<void> {
  await db.runEpic.update({ where: { id }, data });
}

async function appendLog(runId: string, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const run = await db.run.findUnique({
    where: { id: runId },
    select: { logs: true },
  });
  const currentLogs = run?.logs || "";
  await db.run.update({
    where: { id: runId },
    data: { logs: `${currentLogs}[${timestamp}] ${message}\n` },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## 4. Server Actions

### 4.1 Type Definitions

Add to `lib/types.ts`:

```typescript
// ============================================
// Generate All Stories Types
// ============================================

export interface GenerateAllStoriesInput {
  projectId: string;
  mode: GenerationMode;
  personaSet: PersonaSet;
  pacingProfile: "safe" | "normal" | "fast";
  epicIds?: string[];  // Optional: specific epics to process
}

export interface GenerateAllStoriesResult {
  success: boolean;
  runId?: string;
  error?: string;
}

export interface RunEpicProgress {
  epicId: string;
  epicCode: string;
  epicTitle: string;
  status: RunEpicStatus;
  storiesCreated: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface GenerateAllStoriesProgress {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  phaseDetail?: string;

  // Counters
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
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

export interface RetryFailedEpicsResult {
  success: boolean;
  newRunId?: string;
  error?: string;
  retriedEpicCount?: number;
}
```

### 4.2 Server Action Implementations

```typescript
// server/actions/batch-generation.ts

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  executeGenerateAllStories,
  markStoryRunCancelled,
  isStoryRunActive,
} from "@/lib/run-engine/story-executor";
import {
  RunType,
  RunStatus,
  RunPhase,
  RunEpicStatus,
  GenerateAllStoriesInput,
  GenerateAllStoriesResult,
  GenerateAllStoriesProgress,
  RunEpicProgress,
  RetryFailedEpicsResult,
  PacingProfile,
} from "@/lib/types";

/**
 * Start batch story generation for all epics in a project.
 *
 * IMPORTANT: This function awaits the executor because Vercel
 * serverless functions terminate when the response is sent.
 * The 300s Pro timeout should be sufficient for most projects.
 *
 * For very large projects (50+ epics), consider:
 * 1. Processing in chunks with multiple runs
 * 2. Using Vercel Queue (if available)
 * 3. Client-side orchestration with multiple API calls
 */
export async function startGenerateAllStories(
  input: GenerateAllStoriesInput
): Promise<GenerateAllStoriesResult> {
  const { projectId, mode, personaSet, pacingProfile, epicIds } = input;

  try {
    // Validate project exists and has epics
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        epics: {
          select: { id: true },
        },
      },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Filter epics if specific IDs provided
    let targetEpicIds = project.epics.map((e) => e.id);
    if (epicIds && epicIds.length > 0) {
      targetEpicIds = targetEpicIds.filter((id) => epicIds.includes(id));
    }

    if (targetEpicIds.length === 0) {
      return { success: false, error: "No epics found to process" };
    }

    // Check for existing active run
    const activeRun = await db.run.findFirst({
      where: {
        projectId,
        type: RunType.GENERATE_ALL_STORIES,
        status: RunStatus.RUNNING,
      },
    });

    if (activeRun) {
      return {
        success: false,
        error: "A batch story generation is already in progress for this project",
      };
    }

    // Create run record
    const run = await db.run.create({
      data: {
        projectId,
        type: RunType.GENERATE_ALL_STORIES,
        status: RunStatus.QUEUED,
        phase: RunPhase.INITIALIZING,
        inputConfig: JSON.stringify({
          mode,
          personaSet,
          pacingProfile,
          epicIds: targetEpicIds,
        }),
        totalItems: targetEpicIds.length,
        logs: `[${new Date().toISOString()}] Run created, starting execution...\n`,
      },
    });

    // Execute (await required for serverless)
    await executeGenerateAllStories({
      runId: run.id,
      mode,
      personaSet,
      pacingProfile: pacingProfile as PacingProfile,
      epicIds: targetEpicIds,
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/runs/${run.id}`);

    return { success: true, runId: run.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMsg };
  }
}

/**
 * Get detailed progress for a batch story generation run.
 */
export async function getGenerateAllStoriesProgress(
  runId: string
): Promise<GenerateAllStoriesProgress | null> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runEpics: {
        include: {
          epic: {
            select: {
              id: true,
              code: true,
              title: true,
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!run) return null;

  const epics: RunEpicProgress[] = run.runEpics.map((re) => ({
    epicId: re.epic.id,
    epicCode: re.epic.code,
    epicTitle: re.epic.title,
    status: re.status as RunEpicStatus,
    storiesCreated: re.storiesCreated,
    error: re.errorMsg || undefined,
    startedAt: re.startedAt || undefined,
    completedAt: re.completedAt || undefined,
    durationMs: re.durationMs || undefined,
  }));

  // Calculate timing
  const elapsedMs = run.startedAt
    ? Date.now() - run.startedAt.getTime()
    : undefined;

  // Estimate remaining time based on average epic duration
  let estimatedRemainingMs: number | undefined;
  const completedEpics = epics.filter((e) => e.status === RunEpicStatus.COMPLETED);
  if (completedEpics.length > 0 && run.completedItems < run.totalItems) {
    const avgDurationMs =
      completedEpics.reduce((sum, e) => sum + (e.durationMs || 0), 0) /
      completedEpics.length;
    const remainingEpics = run.totalItems - run.completedItems - run.failedItems;
    estimatedRemainingMs = avgDurationMs * remainingEpics;
  }

  return {
    runId: run.id,
    status: run.status as RunStatus,
    phase: run.phase as RunPhase,
    phaseDetail: run.phaseDetail || undefined,
    totalEpics: run.totalItems,
    completedEpics: run.completedItems,
    failedEpics: run.failedItems,
    totalStories: run.totalCards,  // Reusing totalCards for story count
    epics,
    startedAt: run.startedAt || undefined,
    elapsedMs,
    estimatedRemainingMs,
    error: run.errorMsg || undefined,
  };
}

/**
 * Cancel an active batch story generation run.
 * The current epic will complete before stopping.
 */
export async function cancelGenerateAllStories(
  runId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if run is active in memory
  if (isStoryRunActive(runId)) {
    markStoryRunCancelled(runId);
    return { success: true };
  }

  // Check if run exists and is running in DB
  const run = await db.run.findUnique({
    where: { id: runId },
    select: { status: true },
  });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.status !== RunStatus.RUNNING) {
    return { success: false, error: "Run is not active" };
  }

  // Run might be in a different process/instance
  // Update DB directly as fallback
  await db.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.CANCELLED,
      completedAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Retry failed epics from a previous run.
 * Creates a NEW run with only the failed epic IDs.
 *
 * This is the recommended retry approach because:
 * 1. Preserves the original run for audit/debugging
 * 2. Avoids complex state restoration
 * 3. Clear separation of attempts
 */
export async function retryFailedEpics(
  runId: string
): Promise<RetryFailedEpicsResult> {
  try {
    // Load original run with failed epics
    const originalRun = await db.run.findUnique({
      where: { id: runId },
      include: {
        runEpics: {
          where: { status: RunEpicStatus.FAILED },
          include: {
            epic: { select: { id: true } },
          },
        },
      },
    });

    if (!originalRun) {
      return { success: false, error: "Original run not found" };
    }

    if (originalRun.runEpics.length === 0) {
      return { success: false, error: "No failed epics to retry" };
    }

    // Parse original config
    const originalConfig = originalRun.inputConfig
      ? JSON.parse(originalRun.inputConfig)
      : {};

    const failedEpicIds = originalRun.runEpics.map((re) => re.epic.id);

    // Start new run with failed epics
    const result = await startGenerateAllStories({
      projectId: originalRun.projectId,
      mode: originalConfig.mode || "standard",
      personaSet: originalConfig.personaSet || "core",
      pacingProfile: originalConfig.pacingProfile || "normal",
      epicIds: failedEpicIds,
    });

    if (result.success) {
      return {
        success: true,
        newRunId: result.runId,
        retriedEpicCount: failedEpicIds.length,
      };
    }

    return { success: false, error: result.error };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMsg };
  }
}

/**
 * Get epic-level progress for UI display.
 * Lighter weight than full progress - just the essentials.
 */
export async function getRunEpicProgress(
  runId: string
): Promise<RunEpicProgress[]> {
  const runEpics = await db.runEpic.findMany({
    where: { runId },
    include: {
      epic: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    },
    orderBy: { order: "asc" },
  });

  return runEpics.map((re) => ({
    epicId: re.epic.id,
    epicCode: re.epic.code,
    epicTitle: re.epic.title,
    status: re.status as RunEpicStatus,
    storiesCreated: re.storiesCreated,
    error: re.errorMsg || undefined,
    startedAt: re.startedAt || undefined,
    completedAt: re.completedAt || undefined,
    durationMs: re.durationMs || undefined,
  }));
}
```

---

## 5. Database Update Points

### 5.1 Update Frequency Matrix

| Event | Run Updates | RunEpic Updates | Log Entry |
|-------|------------|-----------------|-----------|
| Run starts | status=RUNNING, phase=INITIALIZING, startedAt | - | "Starting batch..." |
| Queueing starts | phase=QUEUEING_EPICS, totalItems | Create all RunEpic records | "Queueing N epics" |
| Epic starts | phaseDetail | status=GENERATING, startedAt | "[E1] Starting..." |
| Epic succeeds | completedItems++, totalCards | status=COMPLETED, storiesCreated, durationMs | "[E1] Completed: N stories" |
| Epic fails | failedItems++ | status=FAILED, errorMsg, durationMs | "[E1] FAILED: error" |
| Run completes | status, phase=COMPLETED, completedAt, durationMs, outputData | - | "Completed: summary" |
| Run cancelled | status=CANCELLED, completedAt, durationMs | Leave PENDING as-is | "Run cancelled" |
| Run fatal error | status=FAILED, phase=FAILED, errorMsg | - | "FATAL ERROR: msg" |

### 5.2 UI Polling Recommendations

```typescript
// Recommended polling intervals for UI
const POLLING_CONFIG = {
  // While run is active (RUNNING status)
  activePollingIntervalMs: 2000,  // Every 2 seconds

  // When run is complete/failed (one final poll)
  finalPollDelayMs: 500,

  // Timeout before showing "stale" warning
  staleWarningThresholdMs: 60000,  // 1 minute without update
};
```

---

## 6. Error Handling Flow

### 6.1 Error Categories

```
Error Categories:
├── Fatal Errors (run fails immediately)
│   ├── Run not found
│   ├── No epics to process
│   └── Database connection failure
│
├── Per-Epic Errors (isolated, continue to next)
│   ├── AI generation failure
│   ├── Rate limit (with retry)
│   ├── Invalid epic data
│   └── Story save failure
│
└── Recoverable Errors (auto-retry)
    ├── Rate limit (429)
    ├── Timeout (with backoff)
    └── Transient API errors
```

### 6.2 Error Response Behavior

```typescript
// Error handling decision tree

function handleError(error: Error, context: ExecutionContext): Action {
  // 1. Rate limit errors: retry with backoff
  if (isRateLimitError(error)) {
    if (context.retryCount < config.maxRetries) {
      return { action: "RETRY", delayMs: calculateBackoff(context) };
    }
    return { action: "FAIL_EPIC", reason: "Max retries exceeded" };
  }

  // 2. Validation errors: fail epic, continue
  if (isValidationError(error)) {
    return { action: "FAIL_EPIC", reason: error.message };
  }

  // 3. Database errors: depends on type
  if (isDatabaseError(error)) {
    if (isTransient(error)) {
      return { action: "RETRY", delayMs: 1000 };
    }
    return { action: "FAIL_RUN", reason: "Database error" };
  }

  // 4. Unknown errors: fail epic, continue
  return { action: "FAIL_EPIC", reason: error.message };
}
```

---

## 7. Chunking Strategy for Large Epics

### 7.1 Context Size Management

For epics with many associated cards (large context), implement summarization:

```typescript
// lib/run-engine/context-optimizer.ts

const MAX_CARDS_WITHOUT_SUMMARY = 10;
const MAX_CONTEXT_CHARS = 8000;

export interface OptimizedEpicContext {
  epicData: EpicData;
  cardSummary?: string;  // Summarized card context if needed
  cardCount: number;
  wasOptimized: boolean;
}

export async function optimizeEpicContext(
  epic: Epic,
  cards: Card[]
): Promise<OptimizedEpicContext> {
  const epicData: EpicData = {
    code: epic.code,
    title: epic.title,
    // ... other fields
  };

  // If few cards, no optimization needed
  if (cards.length <= MAX_CARDS_WITHOUT_SUMMARY) {
    return {
      epicData,
      cardCount: cards.length,
      wasOptimized: false,
    };
  }

  // Summarize cards to reduce context size
  const cardSummary = summarizeCards(cards);

  return {
    epicData,
    cardSummary,
    cardCount: cards.length,
    wasOptimized: true,
  };
}

function summarizeCards(cards: Card[]): string {
  // Group cards by theme/priority
  const themes = new Set(cards.map(c => c.priority || "unset"));
  const systems = new Set(cards.flatMap(c => (c.systems || "").split(",")));

  return `
This epic is informed by ${cards.length} use case cards covering:
- Themes: ${Array.from(themes).join(", ")}
- Systems: ${Array.from(systems).filter(Boolean).join(", ")}
- Key problems: ${cards.slice(0, 5).map(c => c.problem).filter(Boolean).join("; ")}
`.trim();
}
```

---

## 8. Vercel Timeout Considerations

### 8.1 Timeout Budget

```
Vercel Pro Timeout: 300 seconds (5 minutes)

Budget allocation:
- Initialization: ~5 seconds
- Per epic (normal pacing):
  - AI call: ~10-30 seconds
  - DB operations: ~2 seconds
  - Delay: 1 second
  - Total: ~15-35 seconds per epic

Maximum epics per run (conservative): 300 / 35 = ~8-10 epics
Maximum epics per run (optimistic): 300 / 15 = ~20 epics
```

### 8.2 Large Project Strategy

For projects with 20+ epics, recommend:

```typescript
// UI should warn users and suggest chunking
const EPIC_WARNING_THRESHOLD = 15;
const EPIC_HARD_LIMIT = 25;

function validateEpicCount(epicCount: number): ValidationResult {
  if (epicCount > EPIC_HARD_LIMIT) {
    return {
      valid: false,
      error: `Too many epics (${epicCount}). Please select up to ${EPIC_HARD_LIMIT} epics per batch.`,
      suggestion: "Consider running in multiple batches",
    };
  }

  if (epicCount > EPIC_WARNING_THRESHOLD) {
    return {
      valid: true,
      warning: `Processing ${epicCount} epics may take several minutes.`,
    };
  }

  return { valid: true };
}
```

---

## 9. API Summary

### 9.1 Server Actions

| Action | Input | Output | Description |
|--------|-------|--------|-------------|
| `startGenerateAllStories` | `GenerateAllStoriesInput` | `GenerateAllStoriesResult` | Start batch generation |
| `getGenerateAllStoriesProgress` | `runId: string` | `GenerateAllStoriesProgress \| null` | Get detailed progress |
| `cancelGenerateAllStories` | `runId: string` | `{ success, error? }` | Cancel active run |
| `retryFailedEpics` | `runId: string` | `RetryFailedEpicsResult` | Retry failed epics in new run |
| `getRunEpicProgress` | `runId: string` | `RunEpicProgress[]` | Get epic-level progress only |

### 9.2 Type Exports

All new types should be exported from `lib/types.ts`:

```typescript
export {
  // Enums
  RunEpicStatus,
  PacingProfile,

  // Input types
  GenerateAllStoriesInput,

  // Output types
  GenerateAllStoriesResult,
  GenerateAllStoriesProgress,
  RunEpicProgress,
  RetryFailedEpicsResult,

  // Config types
  PacingConfig,
};
```

---

## 10. Migration Steps

1. **Schema Migration**
   ```bash
   npx prisma migrate dev --name add_run_epic
   ```

2. **Type Updates**
   - Add new types to `lib/types.ts`

3. **Executor Implementation**
   - Create `lib/run-engine/pacing.ts`
   - Create `lib/run-engine/rate-limiter.ts`
   - Create `lib/run-engine/story-executor.ts`

4. **Server Actions**
   - Create `server/actions/batch-generation.ts`

5. **Testing**
   - Unit tests for pacing/rate limiting
   - Integration tests for executor
   - E2E tests for full flow
