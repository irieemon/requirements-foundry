// ============================================
// Run Engine Executor
// Async in-process execution of analysis runs
// ============================================

import { db } from "@/lib/db";
import { getDocumentAnalyzer } from "@/lib/ai/document-analyzer";
import type { ExtractedContent, ExtractedImage } from "@/lib/documents/types";
import {
  RunStatus,
  RunPhase,
  RunUploadStatus,
  ExtractionStatus,
  AnalysisStatus,
} from "@/lib/types";

// Track active runs for cancellation
const activeRuns = new Map<string, { cancelled: boolean }>();

// ============================================
// Main Executor
// ============================================

export async function executeRun(runId: string): Promise<void> {
  const context = { cancelled: false };
  activeRuns.set(runId, context);

  try {
    // 1. Transition to RUNNING
    await updateRun(runId, {
      status: RunStatus.RUNNING,
      phase: RunPhase.INITIALIZING,
      startedAt: new Date(),
    });

    await appendLog(runId, "Starting analysis run...");

    // 2. Load run with uploads
    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        project: true,
        runUploads: {
          include: {
            upload: {
              include: { images: true },
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

    const options = run.inputConfig ? JSON.parse(run.inputConfig) : {};

    await updateRun(runId, { phase: RunPhase.LOADING_CONTENT });
    await appendLog(runId, `Loading ${run.runUploads.length} document(s)...`);

    // 3. Get analyzer
    const analyzer = getDocumentAnalyzer();
    const isRealAI = analyzer.isAvailable();
    await appendLog(runId, `Using ${isRealAI ? "Claude AI" : "Mock"} analyzer`);

    await updateRun(runId, { phase: RunPhase.ANALYZING });

    // 4. Process each upload
    let totalCardsCreated = 0;
    let completedCount = 0;
    let failedCount = 0;

    for (const runUpload of run.runUploads) {
      if (context.cancelled) {
        await handleCancellation(runId);
        return;
      }

      const { upload } = runUpload;
      const startTime = Date.now();

      try {
        // Update per-upload status to LOADING
        await updateRunUpload(runUpload.id, {
          status: RunUploadStatus.LOADING,
          startedAt: new Date(),
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
        await updateRunUpload(runUpload.id, { status: RunUploadStatus.ANALYZING });

        // Analyze document
        const result = await analyzer.analyzeDocument(content, {
          maxCards: options.maxCardsPerUpload || 20,
          includeRawText: true,
          projectContext: run.project.description || undefined,
        });

        if (!result.success || !result.cards) {
          throw new Error(result.error || "Analysis failed");
        }

        // Update to SAVING
        await updateRunUpload(runUpload.id, { status: RunUploadStatus.SAVING });

        // Handle existing cards if replaceExisting
        if (options.replaceExisting) {
          await db.card.deleteMany({
            where: { uploadId: upload.id },
          });
        }

        // Create cards (batched for performance)
        const cardsData = result.cards.map((cardData) => ({
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
        }));

        await db.card.createMany({ data: cardsData });

        const cardsCreated = result.cards.length;
        totalCardsCreated += cardsCreated;
        completedCount++;

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
        await updateRunUpload(runUpload.id, {
          status: RunUploadStatus.COMPLETED,
          completedAt: new Date(),
          cardsCreated,
          tokensUsed: result.tokensUsed || 0,
          durationMs,
        });

        // Update run counters
        await db.run.update({
          where: { id: runId },
          data: {
            completedItems: completedCount,
            totalCards: totalCardsCreated,
            phaseDetail: `Processed ${completedCount} of ${run.totalItems} documents`,
          },
        });

        await appendLog(
          runId,
          `✓ ${upload.filename || "Untitled"}: ${cardsCreated} cards (${durationMs}ms)`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        failedCount++;

        await updateRunUpload(runUpload.id, {
          status: RunUploadStatus.FAILED,
          completedAt: new Date(),
          errorMsg,
          durationMs: Date.now() - startTime,
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
          data: { failedItems: failedCount },
        });

        await appendLog(runId, `✗ ${upload.filename || "Untitled"}: ${errorMsg}`);
      }
    }

    // 5. Finalize
    if (!context.cancelled) {
      await updateRun(runId, { phase: RunPhase.FINALIZING });

      const finalRun = await db.run.findUnique({ where: { id: runId } });
      const durationMs = finalRun?.startedAt
        ? Date.now() - finalRun.startedAt.getTime()
        : 0;

      await updateRun(runId, {
        status: RunStatus.SUCCEEDED,
        phase: RunPhase.COMPLETED,
        completedAt: new Date(),
        durationMs,
        phaseDetail: null,
        outputData: JSON.stringify({
          totalCards: totalCardsCreated,
          processedUploads: completedCount,
          failedUploads: failedCount,
        }),
      });

      await appendLog(
        runId,
        `Completed: ${totalCardsCreated} cards from ${completedCount} documents` +
          (failedCount > 0 ? ` (${failedCount} failed)` : "")
      );
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
    activeRuns.delete(runId);
  }
}

// ============================================
// Cancellation
// ============================================

export function markRunCancelled(runId: string): boolean {
  const context = activeRuns.get(runId);
  if (context) {
    context.cancelled = true;
    return true;
  }
  return false;
}

export function isRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}

async function handleCancellation(runId: string): Promise<void> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { runUploads: true },
  });

  if (!run) return;

  // Reset pending uploads back to PENDING analysis status
  const pendingUploadIds = run.runUploads
    .filter((ru) => ru.status === RunUploadStatus.PENDING)
    .map((ru) => ru.uploadId);

  if (pendingUploadIds.length > 0) {
    await db.upload.updateMany({
      where: { id: { in: pendingUploadIds } },
      data: { analysisStatus: AnalysisStatus.PENDING },
    });
  }

  await updateRun(runId, {
    status: RunStatus.CANCELLED,
    completedAt: new Date(),
    durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
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
    totalCards?: number;
  }
): Promise<void> {
  await db.run.update({ where: { id: runId }, data });
}

async function updateRunUpload(
  id: string,
  data: {
    status?: string;
    startedAt?: Date;
    completedAt?: Date;
    durationMs?: number;
    tokensUsed?: number;
    cardsCreated?: number;
    errorMsg?: string;
  }
): Promise<void> {
  await db.runUpload.update({ where: { id }, data });
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
