// ============================================
// Batch Story Executor
// Sequential processing of story generation across all epics
// ============================================

import { db } from "@/lib/db";
import { getAIProvider, hasAnthropicKey } from "@/lib/ai/provider";
import {
  RunStatus,
  RunPhase,
  RunEpicStatus,
  ExistingStoriesBehavior,
  ProcessingPacing,
  PACING_CONFIG,
  type GenerationMode,
  type PersonaSet,
} from "@/lib/types";

// Track active runs for cancellation
const activeRuns = new Map<string, { cancelled: boolean }>();

// ============================================
// Main Executor
// ============================================

export async function executeBatchStoryRun(runId: string): Promise<void> {
  const context = { cancelled: false };
  activeRuns.set(runId, context);

  try {
    // 1. Transition to RUNNING
    await updateRun(runId, {
      status: RunStatus.RUNNING,
      phase: RunPhase.INITIALIZING,
      startedAt: new Date(),
    });

    await appendLog(runId, "Starting batch story generation...");

    // 2. Load run with epics
    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
        runEpics: {
          include: {
            epic: {
              include: {
                _count: { select: { stories: true } },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!run) {
      throw new Error("Run not found");
    }

    if (context.cancelled) {
      await handleCancellation(runId);
      return;
    }

    // Parse configuration
    const options = run.inputConfig ? JSON.parse(run.inputConfig) : {};
    const mode: GenerationMode = options.mode || "standard";
    const personaSet: PersonaSet = options.personaSet || "core";
    const existingBehavior: ExistingStoriesBehavior = options.existingStoriesBehavior || "skip";
    const pacing: ProcessingPacing = options.pacing || "safe";
    const pacingConfig = PACING_CONFIG[pacing];

    await updateRun(runId, { phase: RunPhase.QUEUEING_EPICS });
    await appendLog(runId, `Processing ${run.runEpics.length} epic(s)`);
    await appendLog(runId, `Mode: ${mode}, Personas: ${personaSet}, Pacing: ${pacing}`);
    await appendLog(runId, `Existing stories behavior: ${existingBehavior}`);

    // 3. Get AI provider
    const provider = getAIProvider();
    const isRealAI = hasAnthropicKey();
    await appendLog(runId, `Using ${isRealAI ? "Anthropic API" : "Mock Provider"}`);

    await updateRun(runId, { phase: RunPhase.GENERATING_STORIES });

    // 4. Process each epic sequentially
    let totalStoriesCreated = 0;
    let completedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < run.runEpics.length; i++) {
      if (context.cancelled) {
        await handleCancellation(runId);
        return;
      }

      const runEpic = run.runEpics[i];
      const { epic } = runEpic;
      const startTime = Date.now();

      // Update current processing pointer
      await updateRun(runId, {
        currentItemId: epic.id,
        currentItemIndex: i + 1,
        phaseDetail: `Processing Epic ${i + 1} of ${run.runEpics.length}: ${epic.title}`,
      });

      try {
        // Check if epic has existing stories and handle based on behavior
        const existingStoryCount = epic._count.stories;

        if (existingStoryCount > 0 && existingBehavior === ExistingStoriesBehavior.SKIP) {
          // Skip this epic
          skippedCount++;

          await updateRunEpic(runEpic.id, {
            status: RunEpicStatus.SKIPPED,
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
          });

          await db.run.update({
            where: { id: runId },
            data: { skippedItems: skippedCount },
          });

          await appendLog(runId, `⊘ ${epic.code}: Skipped (${existingStoryCount} existing stories)`);
          continue;
        }

        // Mark epic as GENERATING
        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.GENERATING,
          startedAt: new Date(),
        });

        await appendLog(runId, `Generating stories for ${epic.code}: ${epic.title}`);

        // Build epic data for generation
        const epicData = {
          code: epic.code,
          title: epic.title,
          theme: epic.theme || undefined,
          description: epic.description || undefined,
          businessValue: epic.businessValue || undefined,
          acceptanceCriteria: epic.acceptanceCriteria ? JSON.parse(epic.acceptanceCriteria) : undefined,
          dependencies: epic.dependencies ? JSON.parse(epic.dependencies) : undefined,
          effort: epic.effort || undefined,
          impact: epic.impact || undefined,
          priority: epic.priority || undefined,
        };

        // Generate stories
        const result = await provider.generateStories(epicData, mode, personaSet);

        if (!result.success || !result.data) {
          throw new Error(result.error || "Story generation failed");
        }

        // Mark epic as SAVING
        await updateRunEpic(runEpic.id, { status: RunEpicStatus.SAVING });

        // Delete existing stories if in replace mode
        let storiesDeleted = 0;
        if (existingStoryCount > 0 && existingBehavior === ExistingStoriesBehavior.REPLACE) {
          await db.story.deleteMany({ where: { epicId: epic.id } });
          storiesDeleted = existingStoryCount;
          await appendLog(runId, `  Deleted ${storiesDeleted} existing stories`);
        }

        // Create new stories
        for (const story of result.data) {
          await db.story.create({
            data: {
              epicId: epic.id,
              code: story.code,
              title: story.title,
              userStory: story.userStory,
              persona: story.persona || null,
              acceptanceCriteria: story.acceptanceCriteria ? JSON.stringify(story.acceptanceCriteria) : null,
              technicalNotes: story.technicalNotes || null,
              priority: story.priority || null,
              effort: story.effort || null,
              runId: runId,
            },
          });
        }

        const storiesCreated = result.data.length;
        totalStoriesCreated += storiesCreated;
        completedCount++;

        const durationMs = Date.now() - startTime;

        // Update RunEpic as completed
        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.COMPLETED,
          completedAt: new Date(),
          storiesCreated,
          storiesDeleted,
          tokensUsed: result.tokensUsed || 0,
          durationMs,
        });

        // Update run counters
        await db.run.update({
          where: { id: runId },
          data: {
            completedItems: completedCount,
            totalCards: totalStoriesCreated,
          },
        });

        await appendLog(
          runId,
          `✓ ${epic.code}: ${storiesCreated} stories (${durationMs}ms)` +
            (storiesDeleted > 0 ? ` [replaced ${storiesDeleted}]` : "")
        );

        // Apply pacing delay before next epic (if not last)
        if (i < run.runEpics.length - 1 && pacingConfig.delayBetweenEpicsMs > 0) {
          await sleep(pacingConfig.delayBetweenEpicsMs);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        failedCount++;

        await updateRunEpic(runEpic.id, {
          status: RunEpicStatus.FAILED,
          completedAt: new Date(),
          errorMsg,
          durationMs: Date.now() - startTime,
          retryCount: runEpic.retryCount + 1,
        });

        await db.run.update({
          where: { id: runId },
          data: { failedItems: failedCount },
        });

        await appendLog(runId, `✗ ${epic.code}: ${errorMsg}`);

        // Continue to next epic - don't stop the run
      }
    }

    // 5. Finalize
    if (!context.cancelled) {
      await updateRun(runId, {
        phase: RunPhase.FINALIZING,
        currentItemId: null,
        currentItemIndex: null,
      });

      const finalRun = await db.run.findUnique({ where: { id: runId } });
      const durationMs = finalRun?.startedAt
        ? Date.now() - finalRun.startedAt.getTime()
        : 0;

      // Determine final status
      let finalStatus: RunStatus;
      if (failedCount === 0 && skippedCount === 0) {
        finalStatus = RunStatus.SUCCEEDED;
      } else if (completedCount === 0 && failedCount > 0) {
        finalStatus = RunStatus.FAILED;
      } else if (failedCount > 0 || (skippedCount > 0 && completedCount > 0)) {
        finalStatus = RunStatus.PARTIAL;
      } else if (skippedCount === run.runEpics.length) {
        // All epics skipped (all had existing stories)
        finalStatus = RunStatus.SUCCEEDED;
      } else {
        finalStatus = RunStatus.SUCCEEDED;
      }

      await updateRun(runId, {
        status: finalStatus,
        phase: RunPhase.COMPLETED,
        completedAt: new Date(),
        durationMs,
        phaseDetail: null,
        outputData: JSON.stringify({
          totalStoriesCreated,
          completedEpics: completedCount,
          failedEpics: failedCount,
          skippedEpics: skippedCount,
        }),
      });

      const statusLabel = finalStatus === RunStatus.SUCCEEDED ? "Completed" :
                         finalStatus === RunStatus.PARTIAL ? "Completed with errors" : "Failed";

      await appendLog(
        runId,
        `${statusLabel}: ${totalStoriesCreated} stories from ${completedCount} epics` +
          (failedCount > 0 ? ` (${failedCount} failed)` : "") +
          (skippedCount > 0 ? ` (${skippedCount} skipped)` : "")
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BatchStoryRun ${runId}] Fatal error:`, error);

    await updateRun(runId, {
      status: RunStatus.FAILED,
      phase: RunPhase.FAILED,
      completedAt: new Date(),
      errorMsg,
      currentItemId: null,
      currentItemIndex: null,
    });

    await appendLog(runId, `FATAL ERROR: ${errorMsg}`);
  } finally {
    activeRuns.delete(runId);
  }
}

// ============================================
// Cancellation
// ============================================

export function markBatchRunCancelled(runId: string): boolean {
  const context = activeRuns.get(runId);
  if (context) {
    context.cancelled = true;
    return true;
  }
  return false;
}

export function isBatchRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}

async function handleCancellation(runId: string): Promise<void> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { runEpics: true },
  });

  if (!run) return;

  await updateRun(runId, {
    status: RunStatus.CANCELLED,
    completedAt: new Date(),
    durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
    currentItemId: null,
    currentItemIndex: null,
  });

  await appendLog(runId, "Run cancelled by user");
}

// ============================================
// Helpers
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
    skippedItems?: number;
    totalCards?: number;
    currentItemId?: string | null;
    currentItemIndex?: number | null;
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
    storiesDeleted?: number;
    errorMsg?: string;
    retryCount?: number;
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
