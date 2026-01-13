// ============================================
// Process Next Upload - Continuation Endpoint
// POST /api/runs/[id]/process-next-upload
// ============================================
// Processes ONE upload at a time with self-invocation for continuation.
// This pattern works within Vercel's serverless timeout limits.
// Mirrors the batch-stories process-next pattern for card analysis.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRunLogger } from "@/lib/observability";
import { getDocumentAnalyzer } from "@/lib/ai/document-analyzer";
import type { ExtractedContent, ExtractedImage } from "@/lib/documents/types";
import {
  RunType,
  RunStatus,
  RunPhase,
  RunUploadStatus,
  AnalysisStatus,
} from "@/lib/types";
import {
  triggerProcessNextUpload,
  validateBatchSecret,
} from "@/lib/run-engine/process-next-trigger";

// Configure for longer execution (within Vercel Pro limits)
export const maxDuration = 120; // 2 minutes - plenty for one upload
export const runtime = "nodejs";

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

  try {
    logger.invocationStarted(0); // Will update with actual count after query

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

    // Verify this is a card analysis run
    if (run.type !== RunType.ANALYZE_CARDS) {
      return NextResponse.json(
        { error: "Not a card analysis run" },
        { status: 400 }
      );
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

    // 3. Update heartbeat immediately (stale detection)
    await db.run.update({
      where: { id: runId },
      data: { heartbeatAt: new Date() },
    });
    logger.dbHeartbeatUpdated();

    // 4. Find the next PENDING upload
    const pendingRunUpload = await db.runUpload.findFirst({
      where: {
        runId,
        status: RunUploadStatus.PENDING,
      },
      include: {
        upload: {
          include: { images: true },
        },
      },
      orderBy: { order: "asc" },
    });

    // 5. If no pending uploads, finalize the run
    if (!pendingRunUpload) {
      logger.info("run.finalizing", { metadata: { reason: "no_pending_uploads" } });
      await finalizeRun(runId, logger);
      return NextResponse.json({ success: true, message: "Run finalized" });
    }

    // 6. Update run to RUNNING if not already
    if (run.status === RunStatus.QUEUED) {
      await db.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.RUNNING,
          phase: RunPhase.ANALYZING,
          startedAt: new Date(),
        },
      });
      logger.dbRunUpdated(RunStatus.RUNNING, RunPhase.ANALYZING);
    }

    // 7. Process this single upload
    const { upload } = pendingRunUpload;
    const startTime = Date.now();

    // Parse options
    const options = run.inputConfig ? JSON.parse(run.inputConfig) : {};

    // Count total uploads and current position for progress
    const totalUploads = await db.runUpload.count({ where: { runId } });
    const completedCount = await db.runUpload.count({
      where: {
        runId,
        status: { in: [RunUploadStatus.COMPLETED, RunUploadStatus.FAILED, RunUploadStatus.SKIPPED] },
      },
    });

    // Update progress pointer
    await db.run.update({
      where: { id: runId },
      data: {
        currentItemId: upload.id,
        currentItemIndex: completedCount + 1,
        phaseDetail: `Processing upload ${completedCount + 1} of ${totalUploads}: ${upload.filename || "Untitled"}`,
      },
    });

    // Log upload processing start (using epic context for upload tracking)
    logger.setCurrentEpic(upload.id, upload.filename || "Untitled", completedCount);
    logger.info("upload.processing", {
      metadata: {
        uploadId: upload.id,
        filename: upload.filename || "Untitled",
        position: `${completedCount + 1}/${totalUploads}`,
      },
    });

    try {
      // Update per-upload status to LOADING
      await db.runUpload.update({
        where: { id: pendingRunUpload.id },
        data: {
          status: RunUploadStatus.LOADING,
          startedAt: new Date(),
        },
      });

      await appendLog(runId, `Processing: ${upload.filename || "Untitled"}`);

      // Build extracted content object from stored data
      const content: ExtractedContent = {
        text: upload.rawContent,
        images: upload.images.map((img): ExtractedImage => ({
          base64: img.base64,
          mimeType: img.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          index: img.index,
          pageNumber: img.pageNumber || undefined,
          slideNumber: img.slideNumber || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
          description: img.description || undefined,
        })),
        metadata: {
          filename: upload.filename || "unknown",
          mimeType: upload.fileType,
          fileSize: upload.fileSize || 0,
          pageCount: upload.pageCount || undefined,
          slideCount: upload.slideCount || undefined,
          sheetCount: upload.sheetCount || undefined,
          wordCount: upload.wordCount || 0,
          hasImages: upload.hasImages,
          extractionMethod: upload.processingMethod || "unknown",
          processingTimeMs: upload.processingTimeMs || 0,
        },
      };

      // Update to ANALYZING
      await db.runUpload.update({
        where: { id: pendingRunUpload.id },
        data: { status: RunUploadStatus.ANALYZING },
      });

      // Get analyzer
      const analyzer = getDocumentAnalyzer();

      // Log AI request and analyze document
      logger.claudeRequest("document-analyzer", content.text?.length || 0);
      const analysisStartTime = Date.now();

      const result = await analyzer.analyzeDocument(content, {
        maxCards: options.maxCardsPerUpload || 20,
        includeRawText: true,
        projectContext: run.project.description || undefined,
      });

      const analysisDuration = Date.now() - analysisStartTime;
      if (!result.success || !result.cards) {
        logger.claudeError(result.error || "Analysis failed");
        throw new Error(result.error || "Analysis failed");
      }

      logger.claudeResponse(undefined, result.tokensUsed || 0, analysisDuration);

      // Update to SAVING
      await db.runUpload.update({
        where: { id: pendingRunUpload.id },
        data: { status: RunUploadStatus.SAVING },
      });

      // Handle existing cards if replaceExisting
      if (options.replaceExisting) {
        await db.card.deleteMany({
          where: { uploadId: upload.id },
        });
      }

      // Create cards
      for (const cardData of result.cards) {
        await db.card.create({
          data: {
            projectId: run.projectId,
            uploadId: upload.id,
            runId: run.id,
            title: cardData.title,
            problem: cardData.problem,
            targetUsers: cardData.targetUsers,
            currentState: cardData.currentState,
            desiredOutcomes: cardData.desiredOutcomes,
            constraints: cardData.constraints,
            systems: cardData.systems,
            priority: cardData.priority,
            impact: cardData.impact,
            rawText: cardData.rawText,
          },
        });
      }

      const cardsCreated = result.cards.length;
      const durationMs = Date.now() - startTime;

      // Update upload analysis status
      await db.upload.update({
        where: { id: upload.id },
        data: {
          analysisStatus: AnalysisStatus.COMPLETED,
          lastAnalyzedRunId: run.id,
          lastAnalyzedAt: new Date(),
          errorMsg: null,
          errorPhase: null,
        },
      });

      // Update RunUpload as completed
      await db.runUpload.update({
        where: { id: pendingRunUpload.id },
        data: {
          status: RunUploadStatus.COMPLETED,
          completedAt: new Date(),
          cardsCreated,
          tokensUsed: result.tokensUsed || 0,
          durationMs,
        },
      });

      // Update run counters
      await db.run.update({
        where: { id: runId },
        data: {
          completedItems: { increment: 1 },
          totalCards: { increment: cardsCreated },
        },
      });

      await appendLog(
        runId,
        `✓ ${upload.filename || "Untitled"}: ${cardsCreated} cards (${durationMs}ms)`
      );

      logger.info("upload.completed", {
        duration: durationMs,
        metadata: { cardsCreated, tokensUsed: result.tokensUsed || 0 },
      });
      logger.clearCurrentEpic();
    } catch (error) {
      // Upload-level failure - don't stop the whole run
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const durationMs = Date.now() - startTime;

      await db.runUpload.update({
        where: { id: pendingRunUpload.id },
        data: {
          status: RunUploadStatus.FAILED,
          completedAt: new Date(),
          errorMsg,
          durationMs,
        },
      });

      await db.upload.update({
        where: { id: upload.id },
        data: {
          analysisStatus: AnalysisStatus.FAILED,
          errorMsg,
          errorPhase: "analysis",
        },
      });

      await db.run.update({
        where: { id: runId },
        data: { failedItems: { increment: 1 } },
      });

      await appendLog(runId, `✗ ${upload.filename || "Untitled"}: ${errorMsg}`);

      logger.error("upload.failed", error instanceof Error ? error : errorMsg, {
        duration: durationMs,
      });
      logger.clearCurrentEpic();
    }

    // 8. Trigger continuation (fire-and-forget)
    logger.continuationTriggered("/api/runs/[id]/process-next-upload");
    triggerProcessNextUpload(runId);

    return NextResponse.json({
      success: true,
      processed: upload.filename || upload.id,
      message: "Upload processed, continuation triggered",
    });
  } catch (error) {
    logger.error("invocation.fatal_error", error instanceof Error ? error : "Unknown error");

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

  const stats = await db.runUpload.groupBy({
    by: ["status"],
    where: { runId },
    _count: true,
  });

  const counts: Record<string, number> = {};
  for (const s of stats) {
    counts[s.status] = s._count;
  }

  const completed = counts[RunUploadStatus.COMPLETED] || 0;
  const failed = counts[RunUploadStatus.FAILED] || 0;
  const skipped = counts[RunUploadStatus.SKIPPED] || 0;

  // Calculate total cards
  const cardCount = await db.runUpload.aggregate({
    where: { runId },
    _sum: { cardsCreated: true },
  });
  const totalCards = cardCount._sum.cardsCreated || 0;

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
        totalCards,
        processedUploads: completed,
        failedUploads: failed,
        skippedUploads: skipped,
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
    `${statusLabel}: ${totalCards} cards from ${completed} uploads` +
      (failed > 0 ? ` (${failed} failed)` : "") +
      (skipped > 0 ? ` (${skipped} skipped)` : "")
  );

  logger.runCompleted({
    duration: durationMs || 0,
    success: completed,
    failed,
    skipped,
    stories: totalCards,
  });
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
