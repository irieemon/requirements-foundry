// ============================================
// Subtask Executor
// Processes stories and generates subtasks within the process-next loop
// ============================================

import { db } from "@/lib/db";
import { getAIProvider, hasAnthropicKey } from "@/lib/ai/provider";
import { createRunLogger } from "@/lib/observability";
import {
  RunStatus,
  RunPhase,
  RunStoryStatus,
  ExistingStoriesBehavior,
  ProcessingPacing,
  PACING_CONFIG,
  type GenerationMode,
  type StoryData,
} from "@/lib/types";

// Re-export for convenience
export { RunStatus, RunPhase, RunStoryStatus };

// ============================================
// Types
// ============================================

export interface SubtaskExecutionResult {
  success: boolean;
  storiesProcessed: number;
  timedOut: boolean;
  message: string;
}

export interface SubtaskExecutorOptions {
  runId: string;
  timeoutMs: number;
  startTime: number;
  logger: ReturnType<typeof createRunLogger>;
}

// ============================================
// Main Executor
// ============================================

export async function executeSubtaskGeneration(
  options: SubtaskExecutorOptions
): Promise<SubtaskExecutionResult> {
  const { runId, timeoutMs, startTime, logger } = options;

  let storiesProcessed = 0;
  let timedOut = false;

  try {
    // 1. Load the run with stories
    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
      },
    });

    if (!run) {
      return { success: false, storiesProcessed: 0, timedOut: false, message: "Run not found" };
    }

    // 2. Check if run is cancelled or completed
    if (run.status === RunStatus.CANCELLED) {
      logger.info("run.cancelled", { metadata: { reason: "user" } });
      return { success: true, storiesProcessed: 0, timedOut: false, message: "Run cancelled" };
    }

    if (
      run.status === RunStatus.SUCCEEDED ||
      run.status === RunStatus.FAILED ||
      run.status === RunStatus.PARTIAL
    ) {
      return { success: true, storiesProcessed: 0, timedOut: false, message: "Run already completed" };
    }

    // 3. Update to RUNNING if not already
    if (run.status === RunStatus.QUEUED) {
      await db.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.RUNNING,
          phase: RunPhase.GENERATING_SUBTASKS,
          startedAt: new Date(),
          heartbeatAt: new Date(),
        },
      });
      logger.info("run.status_updated", { metadata: { status: RunStatus.RUNNING } });
    }

    // Parse options
    const inputOptions = run.inputConfig ? JSON.parse(run.inputConfig) : {};
    const mode: GenerationMode = inputOptions.mode || "standard";
    const existingBehavior: ExistingStoriesBehavior = inputOptions.existingSubtasksBehavior || "skip";
    const pacing: ProcessingPacing = inputOptions.pacing || "safe";
    const pacingConfig = PACING_CONFIG[pacing];

    // Count total stories
    const totalStories = await db.runStory.count({ where: { runId } });

    // ====================================================
    // MAIN PROCESSING LOOP
    // ====================================================
    while (true) {
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        logger.warn("timeout_approaching", { duration: elapsed, metadata: { threshold: timeoutMs } });
        timedOut = true;
        break;
      }

      // Update heartbeat
      await db.run.update({
        where: { id: runId },
        data: { heartbeatAt: new Date() },
      });

      // Check for cancellation
      const currentRun = await db.run.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (currentRun?.status === RunStatus.CANCELLED) {
        logger.info("run.cancelled", { metadata: { after: `${storiesProcessed} stories` } });
        break;
      }

      // Find next PENDING story
      const pendingStory = await db.runStory.findFirst({
        where: {
          runId,
          status: RunStoryStatus.PENDING,
        },
        include: {
          story: {
            include: {
              epic: { select: { code: true, title: true } },
              _count: { select: { subtasks: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // No more pending stories - done
      if (!pendingStory) {
        logger.info("run.finalizing", { metadata: { reason: "no_pending_stories" } });
        break;
      }

      // Process this story
      const { story } = pendingStory;
      const storyStartTime = Date.now();

      // Count completed for progress
      const completedCount = await db.runStory.count({
        where: {
          runId,
          status: { in: [RunStoryStatus.COMPLETED, RunStoryStatus.SKIPPED, RunStoryStatus.FAILED] },
        },
      });

      // Update progress pointer
      await db.run.update({
        where: { id: runId },
        data: {
          currentItemId: story.id,
          currentItemIndex: completedCount + 1,
          phaseDetail: `Processing Story ${completedCount + 1} of ${totalStories}: ${story.code}`,
        },
      });

      logger.info("story.started", {
        metadata: { storyId: story.id, code: story.code, index: completedCount + 1, total: totalStories },
      });

      try {
        // Check for existing subtasks
        const existingSubtaskCount = story._count.subtasks;

        if (existingSubtaskCount > 0 && existingBehavior === ExistingStoriesBehavior.SKIP) {
          // Skip this story
          await db.runStory.update({
            where: { id: pendingStory.id },
            data: {
              status: RunStoryStatus.SKIPPED,
              completedAt: new Date(),
              durationMs: Date.now() - storyStartTime,
            },
          });

          await incrementRunCounter(runId, "skipped");
          await appendLog(runId, `⊘ ${story.code}: Skipped (${existingSubtaskCount} existing subtasks)`);

          logger.info("story.skipped", { metadata: { existingCount: existingSubtaskCount } });
        } else {
          // Mark as GENERATING
          await db.runStory.update({
            where: { id: pendingStory.id },
            data: {
              status: RunStoryStatus.GENERATING,
              startedAt: new Date(),
            },
          });

          await appendLog(runId, `Generating subtasks for ${story.code}: ${story.title}`);

          // Build story data for generation
          // Safe JSON parse for acceptanceCriteria - may be malformed
          let parsedAC: string[] | undefined;
          if (story.acceptanceCriteria) {
            try {
              parsedAC = JSON.parse(story.acceptanceCriteria);
            } catch {
              // If JSON parse fails, treat as single-item array
              parsedAC = [story.acceptanceCriteria];
              logger.warn("story.ac_parse_fallback", { metadata: { storyId: story.id } });
            }
          }

          const storyData: StoryData = {
            code: story.code,
            title: story.title,
            userStory: story.userStory,
            persona: story.persona || undefined,
            acceptanceCriteria: parsedAC,
            technicalNotes: story.technicalNotes || undefined,
            priority: story.priority || undefined,
            effort: story.effort || undefined,
          };

          const epicContext = {
            code: story.epic.code,
            title: story.epic.title,
          };

          // Generate subtasks via AI
          const provider = getAIProvider();
          const isRealAI = hasAnthropicKey();

          // Update heartbeat before AI call
          await db.run.update({
            where: { id: runId },
            data: { heartbeatAt: new Date() },
          });

          logger.info("ai.request", { metadata: { provider: isRealAI ? "claude" : "mock" } });
          const aiStartTime = Date.now();
          const result = await provider.generateSubtasks(storyData, epicContext, mode);
          const aiDuration = Date.now() - aiStartTime;

          // Update heartbeat after AI call
          await db.run.update({
            where: { id: runId },
            data: { heartbeatAt: new Date() },
          });

          logger.info("ai.response", { duration: aiDuration, metadata: { tokensUsed: result.tokensUsed || 0 } });

          if (!result.success || !result.data) {
            throw new Error(result.error || "Subtask generation failed");
          }

          // Mark as SAVING
          await db.runStory.update({
            where: { id: pendingStory.id },
            data: { status: RunStoryStatus.SAVING },
          });

          // Delete existing subtasks if replace mode
          let subtasksDeleted = 0;
          if (existingSubtaskCount > 0 && existingBehavior === ExistingStoriesBehavior.REPLACE) {
            await db.subtask.deleteMany({ where: { storyId: story.id } });
            subtasksDeleted = existingSubtaskCount;
            await appendLog(runId, `  Deleted ${subtasksDeleted} existing subtasks`);
          }

          // Create new subtasks
          await db.subtask.createMany({
            data: result.data.map((subtask) => ({
              storyId: story.id,
              code: subtask.code,
              title: subtask.title,
              description: subtask.description || null,
              effort: subtask.effort || null,
              runId: runId,
            })),
          });

          const subtasksCreated = result.data.length;
          const durationMs = Date.now() - storyStartTime;

          // Mark story as COMPLETED
          await db.runStory.update({
            where: { id: pendingStory.id },
            data: {
              status: RunStoryStatus.COMPLETED,
              completedAt: new Date(),
              subtasksCreated,
              subtasksDeleted,
              tokensUsed: result.tokensUsed || 0,
              durationMs,
            },
          });

          await incrementRunCounter(runId, "completed", subtasksCreated);
          await appendLog(
            runId,
            `✓ ${story.code}: ${subtasksCreated} subtasks (${durationMs}ms)` +
              (subtasksDeleted > 0 ? ` [replaced ${subtasksDeleted}]` : "")
          );

          logger.info("story.completed", {
            duration: durationMs,
            metadata: { subtasksCreated, subtasksDeleted },
          });
        }

        storiesProcessed++;

      } catch (error) {
        // Story-level failure - don't stop the whole run
        const errorMsg = error instanceof Error ? error.message : "Unknown error";

        await db.runStory.update({
          where: { id: pendingStory.id },
          data: {
            status: RunStoryStatus.FAILED,
            completedAt: new Date(),
            errorMsg,
            durationMs: Date.now() - storyStartTime,
            retryCount: pendingStory.retryCount + 1,
          },
        });

        await incrementRunCounter(runId, "failed");
        await appendLog(runId, `✗ ${story.code}: ${errorMsg}`);

        logger.error("story.failed", error instanceof Error ? error : new Error(errorMsg));
        storiesProcessed++;
      }

      // Apply pacing delay
      if (pacingConfig.delayBetweenEpicsMs > 0) {
        await sleep(pacingConfig.delayBetweenEpicsMs);
      }
    }

    return {
      success: true,
      storiesProcessed,
      timedOut,
      message: timedOut
        ? `Timed out after ${storiesProcessed} stories, continuation needed`
        : "All stories processed",
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error("executor.fatal", error instanceof Error ? error : new Error(errorMsg));

    return {
      success: false,
      storiesProcessed,
      timedOut: false,
      message: errorMsg,
    };
  }
}

// ============================================
// Finalize Run
// ============================================

export async function finalizeSubtaskRun(
  runId: string,
  logger: ReturnType<typeof createRunLogger>
): Promise<void> {
  const run = await db.run.findUnique({ where: { id: runId } });
  if (!run) return;

  const stats = await db.runStory.groupBy({
    by: ["status"],
    where: { runId },
    _count: true,
  });

  const counts: Record<string, number> = {};
  for (const s of stats) {
    counts[s.status] = s._count;
  }

  const completed = counts[RunStoryStatus.COMPLETED] || 0;
  const failed = counts[RunStoryStatus.FAILED] || 0;
  const skipped = counts[RunStoryStatus.SKIPPED] || 0;

  // Calculate total subtasks
  const subtaskCount = await db.runStory.aggregate({
    where: { runId },
    _sum: { subtasksCreated: true },
  });
  const totalSubtasks = subtaskCount._sum.subtasksCreated || 0;

  // Determine final status
  let finalStatus: RunStatus;
  if (failed === 0 && skipped === 0) {
    finalStatus = RunStatus.SUCCEEDED;
  } else if (completed === 0 && failed > 0) {
    finalStatus = RunStatus.FAILED;
  } else if (failed > 0 || (skipped > 0 && completed > 0)) {
    finalStatus = RunStatus.PARTIAL;
  } else {
    finalStatus = RunStatus.SUCCEEDED;
  }

  const durationMs = run.startedAt ? Date.now() - run.startedAt.getTime() : null;

  // Build error message for failed runs (aggregate individual story errors)
  let errorMsg: string | null = run.errorMsg; // Preserve any existing error
  if (finalStatus === RunStatus.FAILED && !errorMsg) {
    // Get first failed story's error for context
    const firstFailed = await db.runStory.findFirst({
      where: { runId, status: RunStoryStatus.FAILED },
      select: { errorMsg: true, story: { select: { code: true } } },
    });
    if (firstFailed?.errorMsg) {
      errorMsg = `${firstFailed.story.code}: ${firstFailed.errorMsg}`;
    }
  }

  await db.run.update({
    where: { id: runId },
    data: {
      status: finalStatus,
      phase: RunPhase.COMPLETED,
      completedAt: new Date(),
      durationMs,
      currentItemId: null,
      currentItemIndex: null,
      phaseDetail: null,
      errorMsg, // Preserve or set error message
      outputData: JSON.stringify({
        totalSubtasksCreated: totalSubtasks,
        completedStories: completed,
        failedStories: failed,
        skippedStories: skipped,
      }),
    },
  });

  const statusLabel =
    finalStatus === RunStatus.SUCCEEDED
      ? "Completed"
      : finalStatus === RunStatus.PARTIAL
        ? "Completed with errors"
        : "Failed";

  await appendLog(
    runId,
    `${statusLabel}: ${totalSubtasks} subtasks from ${completed} stories` +
      (failed > 0 ? ` (${failed} failed)` : "") +
      (skipped > 0 ? ` (${skipped} skipped)` : "")
  );

  logger.info("run.completed", {
    duration: durationMs || 0,
    metadata: { completed, failed, skipped, subtasks: totalSubtasks },
  });
}

// ============================================
// Helpers
// ============================================

async function incrementRunCounter(
  runId: string,
  type: "completed" | "failed" | "skipped",
  subtasksCreated?: number
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (type === "completed") {
    updateData.completedItems = { increment: 1 };
    if (subtasksCreated) {
      updateData.totalCards = { increment: subtasksCreated };
    }
  } else if (type === "failed") {
    updateData.failedItems = { increment: 1 };
  } else if (type === "skipped") {
    updateData.skippedItems = { increment: 1 };
  }

  await db.run.update({ where: { id: runId }, data: updateData });
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
