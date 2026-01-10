"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { triggerProcessNext } from "@/lib/run-engine/process-next-trigger";
import {
  RunType,
  RunStatus,
  RunPhase,
  RunEpicStatus,
  type GenerateAllStoriesInput,
  type GenerateAllStoriesResult,
  type BatchStoryProgress,
  type RunEpicProgress,
} from "@/lib/types";

// ============================================
// Start Batch Story Generation
// ============================================

export async function startGenerateAllStories(
  input: GenerateAllStoriesInput
): Promise<GenerateAllStoriesResult> {
  const { projectId, options } = input;

  try {
    // 1. Validate project exists
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // 2. Check for existing active batch story run
    const activeRun = await db.run.findFirst({
      where: {
        projectId,
        type: RunType.GENERATE_ALL_STORIES,
        status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
      },
    });

    if (activeRun) {
      return {
        success: false,
        error: "A batch story generation is already in progress for this project",
        runId: activeRun.id,
      };
    }

    // 3. Determine which epics to process
    let epicsToProcess;
    if (options.epicIds && options.epicIds.length > 0) {
      // Specific epics requested (for retry)
      epicsToProcess = await db.epic.findMany({
        where: {
          id: { in: options.epicIds },
          projectId,
        },
        include: {
          _count: { select: { stories: true } },
        },
        orderBy: { priority: "asc" },
      });
    } else {
      // All epics for the project
      epicsToProcess = await db.epic.findMany({
        where: { projectId },
        include: {
          _count: { select: { stories: true } },
        },
        orderBy: { priority: "asc" },
      });
    }

    if (epicsToProcess.length === 0) {
      return { success: false, error: "No epics found for this project" };
    }

    // 4. Create Run record
    const run = await db.run.create({
      data: {
        projectId,
        type: RunType.GENERATE_ALL_STORIES,
        status: RunStatus.QUEUED,
        phase: RunPhase.INITIALIZING,
        inputConfig: JSON.stringify(options),
        totalItems: epicsToProcess.length,
        completedItems: 0,
        failedItems: 0,
        skippedItems: 0,
        totalCards: 0,
        logs: `[${new Date().toISOString()}] Run created with ${epicsToProcess.length} epics\n`,
      },
    });

    // 5. Create RunEpic junction records
    await db.runEpic.createMany({
      data: epicsToProcess.map((epic, index) => ({
        runId: run.id,
        epicId: epic.id,
        status: RunEpicStatus.PENDING,
        order: index,
        mode: options.mode,
        personaSet: options.personaSet,
      })),
    });

    // 6. Fire-and-forget: trigger the first process-next call
    // This pattern works within Vercel's serverless timeout limits
    // Each epic is processed in its own function invocation
    console.log(`[BatchStoryRun ${run.id}] Triggering process-next (fire-and-forget)`);
    triggerProcessNext(run.id);

    // Return immediately - don't wait for processing
    revalidatePath(`/projects/${projectId}`);

    return { success: true, runId: run.id, epicCount: epicsToProcess.length };
  } catch (error) {
    console.error("startGenerateAllStories error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start batch story generation",
    };
  }
}

// ============================================
// Get Batch Story Progress
// ============================================

export async function getBatchStoryProgress(runId: string): Promise<BatchStoryProgress | null> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runEpics: {
        include: {
          epic: {
            select: { code: true, title: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!run) return null;

  // Only return for batch story runs
  if (run.type !== RunType.GENERATE_ALL_STORIES) return null;

  const elapsedMs = run.startedAt ? Date.now() - run.startedAt.getTime() : undefined;

  // Estimate remaining time based on completed rate
  let estimatedRemainingMs: number | undefined;
  if (run.completedItems > 0 && run.totalItems > run.completedItems + run.failedItems + run.skippedItems) {
    const avgTimePerItem = elapsedMs! / run.completedItems;
    const remainingItems = run.totalItems - run.completedItems - run.failedItems - run.skippedItems;
    estimatedRemainingMs = Math.round(avgTimePerItem * remainingItems);
  }

  // Find current epic
  const currentRunEpic = run.runEpics.find(
    (re) => re.status === RunEpicStatus.GENERATING || re.status === RunEpicStatus.SAVING
  );

  const epics: RunEpicProgress[] = run.runEpics.map((re) => ({
    epicId: re.epicId,
    epicCode: re.epic.code,
    epicTitle: re.epic.title,
    status: re.status as RunEpicProgress["status"],
    storiesCreated: re.storiesCreated,
    storiesDeleted: re.storiesDeleted,
    error: re.errorMsg || undefined,
    durationMs: re.durationMs || undefined,
  }));

  return {
    runId: run.id,
    status: run.status as BatchStoryProgress["status"],
    phase: run.phase as BatchStoryProgress["phase"],
    phaseDetail: run.phaseDetail || undefined,
    totalEpics: run.totalItems,
    completedEpics: run.completedItems,
    failedEpics: run.failedItems,
    skippedEpics: run.skippedItems,
    totalStoriesCreated: run.totalCards,
    currentEpicIndex: currentRunEpic ? currentRunEpic.order + 1 : undefined,
    currentEpicId: currentRunEpic?.epicId,
    currentEpicTitle: currentRunEpic?.epic.title,
    epics,
    startedAt: run.startedAt || undefined,
    elapsedMs,
    estimatedRemainingMs,
    error: run.errorMsg || undefined,
  };
}

// ============================================
// Cancel Batch Story Run
// ============================================

export async function cancelBatchStoryRun(
  runId: string
): Promise<{ success: boolean; error?: string }> {
  const run = await db.run.findUnique({ where: { id: runId } });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.type !== RunType.GENERATE_ALL_STORIES) {
    return { success: false, error: "Not a batch story run" };
  }

  if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.QUEUED) {
    return { success: false, error: "Run is not active" };
  }

  // With the continuation pattern, we just mark the run as cancelled
  // The next process-next call will see this and stop
  await db.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.CANCELLED,
      completedAt: new Date(),
    },
  });

  revalidatePath(`/projects/${run.projectId}`);

  return { success: true };
}

// ============================================
// Retry Failed Epics
// ============================================

export async function retryFailedEpics(
  originalRunId: string
): Promise<GenerateAllStoriesResult> {
  const run = await db.run.findUnique({
    where: { id: originalRunId },
    include: {
      runEpics: {
        where: { status: RunEpicStatus.FAILED },
        select: { epicId: true },
      },
    },
  });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.type !== RunType.GENERATE_ALL_STORIES) {
    return { success: false, error: "Not a batch story run" };
  }

  const failedEpicIds = run.runEpics.map((re) => re.epicId);

  if (failedEpicIds.length === 0) {
    return { success: false, error: "No failed epics to retry" };
  }

  // Parse original options
  const originalOptions = run.inputConfig ? JSON.parse(run.inputConfig) : {};

  // Start a new run with just the failed epics
  return startGenerateAllStories({
    projectId: run.projectId,
    options: {
      ...originalOptions,
      epicIds: failedEpicIds,
    },
  });
}

// ============================================
// Get Active Batch Story Run (with Stale Detection)
// ============================================

// Stale threshold: 2 minutes without heartbeat
const STALE_THRESHOLD_MS = 2 * 60 * 1000;

export interface ActiveBatchStoryRunResult {
  runId: string | null;
  recoveredFromStale?: boolean;
  previousRunId?: string;
}

export async function getActiveBatchStoryRun(
  projectId: string
): Promise<ActiveBatchStoryRunResult> {
  const activeRun = await db.run.findFirst({
    where: {
      projectId,
      type: RunType.GENERATE_ALL_STORIES,
      status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
    },
    select: { id: true, heartbeatAt: true, status: true, startedAt: true, createdAt: true },
  });

  if (!activeRun) {
    return { runId: null };
  }

  // Check for stale run (heartbeat older than threshold)
  // Fallback chain: heartbeatAt -> startedAt -> createdAt
  // This ensures QUEUED runs that never started are also checked
  const lastActivity = activeRun.heartbeatAt || activeRun.startedAt || activeRun.createdAt;
  const isStale = Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS;

  if (isStale) {
    console.log(`[BatchStory StaleDetection] Run ${activeRun.id} is stale (last activity: ${lastActivity?.toISOString()})`);

    // Mark as failed and allow restart
    await db.run.update({
      where: { id: activeRun.id },
      data: {
        status: RunStatus.FAILED,
        phase: RunPhase.FAILED,
        errorMsg: 'Run became stale (worker disconnected)',
        completedAt: new Date(),
      },
    });

    // Reset pending RunEpics (if any) so they can be retried
    await db.runEpic.updateMany({
      where: { runId: activeRun.id, status: RunEpicStatus.PENDING },
      data: { status: RunEpicStatus.FAILED, errorMsg: 'Run became stale' },
    });

    return {
      runId: null,
      recoveredFromStale: true,
      previousRunId: activeRun.id,
    };
  }

  return { runId: activeRun.id };
}

// ============================================
// Get Epics for Batch Generation
// ============================================

export interface EpicForBatch {
  id: string;
  code: string;
  title: string;
  storyCount: number;
}

export async function getEpicsForBatchGeneration(
  projectId: string
): Promise<EpicForBatch[]> {
  const epics = await db.epic.findMany({
    where: { projectId },
    include: {
      _count: { select: { stories: true } },
    },
    orderBy: { priority: "asc" },
  });

  return epics.map((epic) => ({
    id: epic.id,
    code: epic.code,
    title: epic.title,
    storyCount: epic._count.stories,
  }));
}
