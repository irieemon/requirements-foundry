// ============================================
// Process Next Epic - Batch Processing Endpoint
// POST /api/runs/[id]/process-next
// ============================================
// Processes ALL pending epics in a loop within a single invocation.
// This avoids fire-and-forget HTTP self-calls that fail on Vercel serverless.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRunLogger } from "@/lib/observability";
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
import { validateBatchSecret, triggerProcessNext } from "@/lib/run-engine/process-next-trigger";

// Configure for longer execution (Vercel Pro limit)
export const maxDuration = 300; // 5 minutes - process all epics
export const runtime = "nodejs";

// Safety margin: stop processing 20s before timeout to finalize cleanly
const TIMEOUT_SAFETY_MS = 280 * 1000; // 280 seconds

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  // Validate secret (security)
  const secret = request.headers.get("x-batch-secret");
  if (!validateBatchSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create logger for structured observability
  const logger = createRunLogger(runId, request);

  const invocationStartTime = Date.now();
  let epicsProcessed = 0;
  let timedOut = false;

  try {
    logger.invocationStarted(0); // Will update with actual count

    // 1. Load the run
    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // 2. Check if run is cancelled or already completed
    if (run.status === RunStatus.CANCELLED) {
      logger.runCancelled("user", "before processing");
      return NextResponse.json({ success: true, message: "Run cancelled" });
    }

    if (
      run.status === RunStatus.SUCCEEDED ||
      run.status === RunStatus.FAILED ||
      run.status === RunStatus.PARTIAL
    ) {
      logger.info("run.already_completed", { metadata: { status: run.status } });
      return NextResponse.json({ success: true, message: "Run already completed" });
    }

    // 3. Update run to RUNNING if not already
    if (run.status === RunStatus.QUEUED) {
      await db.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.RUNNING,
          phase: RunPhase.GENERATING_STORIES,
          startedAt: new Date(),
          heartbeatAt: new Date(),
        },
      });
      logger.dbRunUpdated(RunStatus.RUNNING, RunPhase.GENERATING_STORIES);
    }

    // Parse options (once, outside the loop)
    const options = run.inputConfig ? JSON.parse(run.inputConfig) : {};
    const mode: GenerationMode = options.mode || "standard";
    const personaSet: PersonaSet = options.personaSet || "core";
    const existingBehavior: ExistingStoriesBehavior =
      options.existingStoriesBehavior || "skip";
    const pacing: ProcessingPacing = options.pacing || "safe";
    const pacingConfig = PACING_CONFIG[pacing];

    // Count total epics (once, for progress)
    const totalEpics = await db.runEpic.count({ where: { runId } });

    // ====================================================
    // MAIN PROCESSING LOOP - process ALL pending epics
    // ====================================================
    while (true) {
      // Check timeout - gracefully stop if approaching limit
      const elapsed = Date.now() - invocationStartTime;
      if (elapsed > TIMEOUT_SAFETY_MS) {
        logger.invocationTimeoutWarning(elapsed, TIMEOUT_SAFETY_MS);
        timedOut = true;
        break;
      }

      // Update heartbeat for stale detection
      await db.run.update({
        where: { id: runId },
        data: { heartbeatAt: new Date() },
      });
      logger.dbHeartbeatUpdated();

      // Check for cancellation (re-fetch run status)
      const currentRun = await db.run.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (currentRun?.status === RunStatus.CANCELLED) {
        logger.runCancelled("user", `after ${epicsProcessed} epics`);
        break;
      }

      // Find the next PENDING epic
      const pendingEpic = await db.runEpic.findFirst({
        where: {
          runId,
          status: RunEpicStatus.PENDING,
        },
        include: {
          epic: {
            include: {
              _count: { select: { stories: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      });

      // No more pending epics - we're done
      if (!pendingEpic) {
        logger.info("run.finalizing", { metadata: { reason: "no_pending_epics" } });
        break;
      }

      // Process this epic
      const { epic } = pendingEpic;
      const epicStartTime = Date.now();

      // Count completed for progress
      const completedCount = await db.runEpic.count({
        where: { runId, status: { in: [RunEpicStatus.COMPLETED, RunEpicStatus.SKIPPED, RunEpicStatus.FAILED] } },
      });

      // Update progress pointer
      await db.run.update({
        where: { id: runId },
        data: {
          currentItemId: epic.id,
          currentItemIndex: completedCount + 1,
          phaseDetail: `Processing Epic ${completedCount + 1} of ${totalEpics}: ${epic.title}`,
        },
      });

      // Log epic processing start
      logger.epicStarted(epic.id, epic.code, completedCount, totalEpics);

      try {
        // Check for existing stories
        const existingStoryCount = epic._count.stories;

        if (existingStoryCount > 0 && existingBehavior === ExistingStoriesBehavior.SKIP) {
          // Skip this epic
          await db.runEpic.update({
            where: { id: pendingEpic.id },
            data: {
              status: RunEpicStatus.SKIPPED,
              completedAt: new Date(),
              durationMs: Date.now() - epicStartTime,
            },
          });

          await incrementRunCounter(runId, "skipped");
          await appendLog(runId, `⊘ ${epic.code}: Skipped (${existingStoryCount} existing stories)`);

          logger.epicSkipped("existing stories", existingStoryCount);
        } else {
          // Mark as GENERATING
          await db.runEpic.update({
            where: { id: pendingEpic.id },
            data: {
              status: RunEpicStatus.GENERATING,
              startedAt: new Date(),
            },
          });

          await appendLog(runId, `Generating stories for ${epic.code}: ${epic.title}`);

          // Build epic data
          const epicData = {
            code: epic.code,
            title: epic.title,
            theme: epic.theme || undefined,
            description: epic.description || undefined,
            businessValue: epic.businessValue || undefined,
            acceptanceCriteria: epic.acceptanceCriteria
              ? JSON.parse(epic.acceptanceCriteria)
              : undefined,
            dependencies: epic.dependencies ? JSON.parse(epic.dependencies) : undefined,
            effort: epic.effort || undefined,
            impact: epic.impact || undefined,
            priority: epic.priority || undefined,
          };

          // Generate stories via AI
          const provider = getAIProvider();
          const isRealAI = hasAnthropicKey();

          // Update heartbeat before long AI call to prevent stale detection
          await db.run.update({
            where: { id: runId },
            data: { heartbeatAt: new Date() },
          });
          logger.dbHeartbeatUpdated();

          // Log AI request and call provider
          logger.claudeRequest(isRealAI ? "claude" : "mock", 0);
          const aiStartTime = Date.now();
          const result = await provider.generateStories(epicData, mode, personaSet);
          const aiDuration = Date.now() - aiStartTime;

          // Update heartbeat after AI call completes
          await db.run.update({
            where: { id: runId },
            data: { heartbeatAt: new Date() },
          });
          logger.dbHeartbeatUpdated();
          logger.claudeResponse(undefined, result.tokensUsed || 0, aiDuration);

          if (!result.success || !result.data) {
            throw new Error(result.error || "Story generation failed");
          }

          // Mark as SAVING
          await db.runEpic.update({
            where: { id: pendingEpic.id },
            data: { status: RunEpicStatus.SAVING },
          });

          // Delete existing if replace mode
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
                acceptanceCriteria: story.acceptanceCriteria
                  ? JSON.stringify(story.acceptanceCriteria)
                  : null,
                technicalNotes: story.technicalNotes || null,
                priority: story.priority || null,
                effort: story.effort || null,
                runId: runId,
              },
            });
          }

          const storiesCreated = result.data.length;
          const durationMs = Date.now() - epicStartTime;

          // Mark epic as COMPLETED
          await db.runEpic.update({
            where: { id: pendingEpic.id },
            data: {
              status: RunEpicStatus.COMPLETED,
              completedAt: new Date(),
              storiesCreated,
              storiesDeleted,
              tokensUsed: result.tokensUsed || 0,
              durationMs,
            },
          });

          await incrementRunCounter(runId, "completed", storiesCreated);
          await appendLog(
            runId,
            `✓ ${epic.code}: ${storiesCreated} stories (${durationMs}ms)` +
              (storiesDeleted > 0 ? ` [replaced ${storiesDeleted}]` : "")
          );

          logger.epicCompleted(storiesCreated, durationMs, storiesDeleted);
        }

        epicsProcessed++;

      } catch (error) {
        // Epic-level failure - don't stop the whole run
        const errorMsg = error instanceof Error ? error.message : "Unknown error";

        await db.runEpic.update({
          where: { id: pendingEpic.id },
          data: {
            status: RunEpicStatus.FAILED,
            completedAt: new Date(),
            errorMsg,
            durationMs: Date.now() - epicStartTime,
            retryCount: pendingEpic.retryCount + 1,
          },
        });

        await incrementRunCounter(runId, "failed");
        await appendLog(runId, `✗ ${epic.code}: ${errorMsg}`);

        logger.epicFailed(error instanceof Error ? error : errorMsg, false);
        epicsProcessed++; // Still count as processed (for accurate reporting)
      }

      // Apply pacing delay (if configured)
      if (pacingConfig.delayBetweenEpicsMs > 0) {
        await sleep(pacingConfig.delayBetweenEpicsMs);
      }
    }

    // ====================================================
    // FINALIZATION
    // ====================================================
    const totalElapsed = Date.now() - invocationStartTime;

    if (timedOut) {
      // We hit the timeout - mark remaining as pending for retry
      logger.warn("invocation.timeout_graceful", {
        duration: totalElapsed,
        metadata: { epicsProcessed },
      });
      await appendLog(runId, `⚠ Processing paused after ${epicsProcessed} epics (timeout - will continue)`);

      // Trigger immediate self-continuation instead of waiting for cron job
      // This prevents the frontend from detecting a "stale" run during the gap
      triggerProcessNext(runId);
      logger.info("run.continuation_triggered", { metadata: { reason: "timeout" } });

      // Small delay to ensure the fetch is initiated before we return
      await sleep(100);

      // Return - leave run in RUNNING state, continuation will pick up
      return NextResponse.json({
        success: true,
        message: `Timed out after ${epicsProcessed} epics, continuation triggered`,
        epicsProcessed,
        timedOut: true,
      });
    }

    // Normal completion - finalize the run
    await finalizeRun(runId, logger);
    logger.invocationCompleted(`${epicsProcessed} epics`, totalElapsed);

    return NextResponse.json({
      success: true,
      message: "All epics processed",
      epicsProcessed,
      durationMs: totalElapsed,
    });

  } catch (error) {
    logger.runFailed(error instanceof Error ? error : "Unknown error");

    // Mark run as failed
    await db.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.FAILED,
        phase: RunPhase.FAILED,
        completedAt: new Date(),
        errorMsg: error instanceof Error ? error.message : "Unknown error",
        currentItemId: null,
        currentItemIndex: null,
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

async function finalizeRun(runId: string, logger: ReturnType<typeof createRunLogger>): Promise<void> {
  const run = await db.run.findUnique({ where: { id: runId } });
  if (!run) return;

  const stats = await db.runEpic.groupBy({
    by: ["status"],
    where: { runId },
    _count: true,
  });

  const counts: Record<string, number> = {};
  for (const s of stats) {
    counts[s.status] = s._count;
  }

  const completed = counts[RunEpicStatus.COMPLETED] || 0;
  const failed = counts[RunEpicStatus.FAILED] || 0;
  const skipped = counts[RunEpicStatus.SKIPPED] || 0;

  // Calculate total stories
  const storyCount = await db.runEpic.aggregate({
    where: { runId },
    _sum: { storiesCreated: true },
  });
  const totalStories = storyCount._sum.storiesCreated || 0;

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
      outputData: JSON.stringify({
        totalStoriesCreated: totalStories,
        completedEpics: completed,
        failedEpics: failed,
        skippedEpics: skipped,
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
    `${statusLabel}: ${totalStories} stories from ${completed} epics` +
      (failed > 0 ? ` (${failed} failed)` : "") +
      (skipped > 0 ? ` (${skipped} skipped)` : "")
  );

  logger.runCompleted({
    duration: durationMs || 0,
    success: completed,
    failed,
    skipped,
    stories: totalStories,
  });
}

async function incrementRunCounter(
  runId: string,
  type: "completed" | "failed" | "skipped",
  storiesCreated?: number
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (type === "completed") {
    updateData.completedItems = { increment: 1 };
    if (storiesCreated) {
      updateData.totalCards = { increment: storiesCreated };
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
