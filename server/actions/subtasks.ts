"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createRunLogger } from "@/lib/observability";
import { triggerProcessNextAsync } from "@/lib/run-engine/process-next-trigger";
import {
  RunType,
  RunStatus,
  RunPhase,
  RunStoryStatus,
  type GenerateSubtasksInput,
  type GenerateSubtasksResult,
  type BatchSubtaskProgress,
  type RunStoryProgress,
} from "@/lib/types";

// ============================================
// Start Batch Subtask Generation
// ============================================

export async function startGenerateSubtasks(
  input: GenerateSubtasksInput
): Promise<GenerateSubtasksResult> {
  const { epicId, storyIds, options } = input;

  try {
    // 1. Validate epic exists and get stories
    const epic = await db.epic.findUnique({
      where: { id: epicId },
      include: {
        stories: storyIds
          ? { where: { id: { in: storyIds } } }
          : true,
        project: { select: { id: true } },
      },
    });

    if (!epic) {
      return { success: false, error: "Epic not found" };
    }

    if (epic.stories.length === 0) {
      return { success: false, error: "No stories found to generate subtasks for" };
    }

    // 2. Check for existing active subtask generation run
    const activeRun = await db.run.findFirst({
      where: {
        projectId: epic.project.id,
        type: RunType.GENERATE_SUBTASKS,
        status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
      },
    });

    if (activeRun) {
      return {
        success: false,
        error: "Subtask generation already in progress for this project",
        runId: activeRun.id,
      };
    }

    // 3. Create run record
    const run = await db.run.create({
      data: {
        projectId: epic.project.id,
        type: RunType.GENERATE_SUBTASKS,
        status: RunStatus.QUEUED,
        phase: RunPhase.INITIALIZING,
        inputConfig: JSON.stringify(options),
        totalItems: epic.stories.length,
        completedItems: 0,
        failedItems: 0,
        skippedItems: 0,
        totalCards: 0,
        logs: `[${new Date().toISOString()}] Run created with ${epic.stories.length} stories from ${epic.code}\n`,
      },
    });

    // 4. Create RunStory junction records
    await db.runStory.createMany({
      data: epic.stories.map((story) => ({
        runId: run.id,
        storyId: story.id,
        status: RunStoryStatus.PENDING,
      })),
    });

    // 5. Log run creation and trigger processing
    const logger = createRunLogger(run.id);
    logger.info("run.created", {
      metadata: {
        epicId,
        storyCount: epic.stories.length,
        mode: options.mode,
        existingBehavior: options.existingSubtasksBehavior,
      },
    });

    // Trigger the first process-next call
    logger.info("invocation.continuation_triggered", {
      metadata: { targetEndpoint: "process-next" },
    });
    const triggerResult = await triggerProcessNextAsync(run.id);

    if (!triggerResult.success) {
      logger.error("continuation_failed", new Error(triggerResult.error || "Unknown error"));

      // Mark the run as failed so the UI shows the error
      await db.run.update({
        where: { id: run.id },
        data: {
          status: RunStatus.FAILED,
          phase: RunPhase.FAILED,
          errorMsg: `Failed to start processing: ${triggerResult.error}`,
          completedAt: new Date(),
        },
      });

      revalidatePath(`/projects/${epic.project.id}`);
      return {
        success: false,
        error: `Failed to start processing: ${triggerResult.error}`,
        runId: run.id,
      };
    }

    revalidatePath(`/projects/${epic.project.id}`);

    return { success: true, runId: run.id, storyCount: epic.stories.length };
  } catch (error) {
    console.error("startGenerateSubtasks error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start subtask generation",
    };
  }
}

// ============================================
// Get Batch Subtask Progress
// ============================================

export async function getBatchSubtaskProgress(runId: string): Promise<BatchSubtaskProgress | null> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runStories: {
        include: {
          story: {
            select: { id: true, code: true, title: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!run) return null;

  // Only return for subtask generation runs
  if (run.type !== RunType.GENERATE_SUBTASKS) return null;

  const elapsedMs = run.startedAt ? Date.now() - run.startedAt.getTime() : undefined;

  // Estimate remaining time based on completed rate
  let estimatedRemainingMs: number | undefined;
  if (run.completedItems > 0 && run.totalItems > run.completedItems + run.failedItems + run.skippedItems) {
    const avgTimePerItem = elapsedMs! / run.completedItems;
    const remainingItems = run.totalItems - run.completedItems - run.failedItems - run.skippedItems;
    estimatedRemainingMs = Math.round(avgTimePerItem * remainingItems);
  }

  // Find current story
  const currentRunStory = run.runStories.find(
    (rs) => rs.status === RunStoryStatus.GENERATING || rs.status === RunStoryStatus.SAVING
  );

  const stories: RunStoryProgress[] = run.runStories.map((rs) => ({
    storyId: rs.storyId,
    storyCode: rs.story.code,
    storyTitle: rs.story.title,
    status: rs.status as RunStoryProgress["status"],
    subtasksCreated: rs.subtasksCreated,
    subtasksDeleted: rs.subtasksDeleted,
    error: rs.errorMsg || undefined,
    durationMs: rs.durationMs || undefined,
  }));

  // Calculate current index
  const completedCount = run.runStories.filter(
    (rs) => rs.status === RunStoryStatus.COMPLETED ||
            rs.status === RunStoryStatus.SKIPPED ||
            rs.status === RunStoryStatus.FAILED
  ).length;

  return {
    runId: run.id,
    status: run.status as BatchSubtaskProgress["status"],
    phase: run.phase as BatchSubtaskProgress["phase"],
    phaseDetail: run.phaseDetail || undefined,
    totalStories: run.totalItems,
    completedStories: run.completedItems,
    failedStories: run.failedItems,
    skippedStories: run.skippedItems,
    totalSubtasksCreated: run.totalCards,
    currentStoryIndex: currentRunStory ? completedCount + 1 : undefined,
    currentStoryId: currentRunStory?.storyId,
    currentStoryTitle: currentRunStory?.story.title,
    stories,
    startedAt: run.startedAt || undefined,
    elapsedMs,
    estimatedRemainingMs,
    error: run.errorMsg || undefined,
  };
}

// ============================================
// Cancel Batch Subtask Run
// ============================================

export async function cancelBatchSubtaskRun(
  runId: string
): Promise<{ success: boolean; error?: string }> {
  const run = await db.run.findUnique({ where: { id: runId } });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.type !== RunType.GENERATE_SUBTASKS) {
    return { success: false, error: "Not a subtask generation run" };
  }

  if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.QUEUED) {
    return { success: false, error: "Run is not active" };
  }

  // Mark the run as cancelled - the next process-next iteration will see this
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
// Retry Failed Stories
// ============================================

export async function retryFailedStories(
  originalRunId: string
): Promise<GenerateSubtasksResult> {
  const run = await db.run.findUnique({
    where: { id: originalRunId },
    include: {
      runStories: {
        where: { status: RunStoryStatus.FAILED },
        include: {
          story: {
            select: { epicId: true },
          },
        },
      },
    },
  });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.type !== RunType.GENERATE_SUBTASKS) {
    return { success: false, error: "Not a subtask generation run" };
  }

  const failedStoryIds = run.runStories.map((rs) => rs.storyId);

  if (failedStoryIds.length === 0) {
    return { success: false, error: "No failed stories to retry" };
  }

  // Get epicId from the first story (all should be from same epic)
  const epicId = run.runStories[0]?.story.epicId;
  if (!epicId) {
    return { success: false, error: "Could not determine epic for retry" };
  }

  // Parse original options
  const originalOptions = run.inputConfig ? JSON.parse(run.inputConfig) : {};

  // Start a new run with just the failed stories
  return startGenerateSubtasks({
    epicId,
    storyIds: failedStoryIds,
    options: originalOptions,
  });
}

// ============================================
// Get Active Subtask Generation Run (with Stale Detection)
// ============================================

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export interface ActiveSubtaskRunResult {
  runId: string | null;
  recoveredFromStale?: boolean;
  previousRunId?: string;
}

export async function getActiveSubtaskRun(
  projectId: string
): Promise<ActiveSubtaskRunResult> {
  const activeRun = await db.run.findFirst({
    where: {
      projectId,
      type: RunType.GENERATE_SUBTASKS,
      status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
    },
    select: { id: true, heartbeatAt: true, status: true, startedAt: true, createdAt: true },
  });

  if (!activeRun) {
    return { runId: null };
  }

  // Check for stale run
  const lastActivity = activeRun.heartbeatAt || activeRun.startedAt || activeRun.createdAt;
  const isStale = Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS;

  if (isStale) {
    console.log(`[SubtaskGen StaleDetection] Run ${activeRun.id} is stale`);

    // Mark as failed and allow restart
    await db.run.update({
      where: { id: activeRun.id },
      data: {
        status: RunStatus.FAILED,
        phase: RunPhase.FAILED,
        errorMsg: "Run became stale (worker disconnected)",
        completedAt: new Date(),
      },
    });

    // Reset pending RunStories
    await db.runStory.updateMany({
      where: { runId: activeRun.id, status: RunStoryStatus.PENDING },
      data: { status: RunStoryStatus.FAILED, errorMsg: "Run became stale" },
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
// Get Stories for Subtask Generation
// ============================================

export interface StoryForSubtasks {
  id: string;
  code: string;
  title: string;
  subtaskCount: number;
}

export async function getStoriesForSubtaskGeneration(
  epicId: string
): Promise<StoryForSubtasks[]> {
  const stories = await db.story.findMany({
    where: { epicId },
    include: {
      _count: { select: { subtasks: true } },
    },
    orderBy: { code: "asc" },
  });

  return stories.map((story) => ({
    id: story.id,
    code: story.code,
    title: story.title,
    subtaskCount: story._count.subtasks,
  }));
}
