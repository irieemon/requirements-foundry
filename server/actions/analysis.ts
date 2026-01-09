"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { triggerProcessNextUpload } from "@/lib/run-engine/process-next-trigger";
import {
  RunType,
  RunStatus,
  RunPhase,
  ExtractionStatus,
  AnalysisStatus,
  type RunProgress,
  type RunUploadProgress,
  type AnalyzeProjectInput,
  type AnalyzeProjectResult,
} from "@/lib/types";

// ============================================
// Start Analysis Run
// ============================================

export async function analyzeProject(
  input: AnalyzeProjectInput
): Promise<AnalyzeProjectResult> {
  const { projectId, uploadIds, options = {} } = input;

  try {
    // 1. Validate project exists
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // 2. Check for existing active run
    const activeRun = await db.run.findFirst({
      where: {
        projectId,
        type: RunType.ANALYZE_CARDS,
        status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
      },
    });

    if (activeRun) {
      return {
        success: false,
        error: "An analysis is already in progress for this project",
        runId: activeRun.id,
      };
    }

    // 3. Determine which uploads to analyze
    let uploadsToAnalyze;
    if (uploadIds && uploadIds.length > 0) {
      // Specific uploads requested
      uploadsToAnalyze = await db.upload.findMany({
        where: {
          id: { in: uploadIds },
          projectId,
          extractionStatus: ExtractionStatus.EXTRACTED,
        },
      });
    } else {
      // All pending uploads (not yet analyzed or failed)
      uploadsToAnalyze = await db.upload.findMany({
        where: {
          projectId,
          extractionStatus: ExtractionStatus.EXTRACTED,
          analysisStatus: { in: [AnalysisStatus.PENDING, AnalysisStatus.FAILED] },
        },
      });
    }

    if (uploadsToAnalyze.length === 0) {
      return { success: false, error: "No uploads ready for analysis" };
    }

    // 4. Create Run record
    const run = await db.run.create({
      data: {
        projectId,
        type: RunType.ANALYZE_CARDS,
        status: RunStatus.QUEUED,
        phase: RunPhase.INITIALIZING,
        inputConfig: JSON.stringify(options),
        totalItems: uploadsToAnalyze.length,
        completedItems: 0,
        failedItems: 0,
        totalCards: 0,
        logs: `[${new Date().toISOString()}] Run created with ${uploadsToAnalyze.length} uploads\n`,
      },
    });

    // 5. Create RunUpload junction records
    await db.runUpload.createMany({
      data: uploadsToAnalyze.map((upload, index) => ({
        runId: run.id,
        uploadId: upload.id,
        status: "PENDING",
        order: index,
      })),
    });

    // 6. Update uploads to QUEUED status
    await db.upload.updateMany({
      where: { id: { in: uploadsToAnalyze.map((u) => u.id) } },
      data: { analysisStatus: AnalysisStatus.QUEUED },
    });

    // 7. Fire-and-forget: trigger the first process-next-upload call
    // This pattern works within Vercel's serverless timeout limits.
    // Each upload is processed in its own function invocation.
    console.log(`[CardAnalysis Run ${run.id}] Triggering process-next-upload (fire-and-forget)`);
    triggerProcessNextUpload(run.id);

    // Return immediately - don't wait for processing
    revalidatePath(`/projects/${projectId}`);

    return { success: true, runId: run.id };
  } catch (error) {
    console.error("analyzeProject error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start analysis",
    };
  }
}

// ============================================
// Get Run Progress
// ============================================

export async function getRunProgress(runId: string): Promise<RunProgress | null> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runUploads: {
        include: {
          upload: {
            select: { filename: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!run) return null;

  const elapsedMs = run.startedAt ? Date.now() - run.startedAt.getTime() : undefined;

  // Estimate remaining time based on completed rate
  let estimatedRemainingMs: number | undefined;
  if (run.completedItems > 0 && run.totalItems > run.completedItems + run.failedItems) {
    const avgTimePerItem = elapsedMs! / run.completedItems;
    const remainingItems = run.totalItems - run.completedItems - run.failedItems;
    estimatedRemainingMs = Math.round(avgTimePerItem * remainingItems);
  }

  const uploads: RunUploadProgress[] = run.runUploads.map((ru) => ({
    uploadId: ru.uploadId,
    filename: ru.upload.filename || "Untitled",
    status: ru.status as RunProgress["uploads"][0]["status"],
    cardsCreated: ru.cardsCreated,
    error: ru.errorMsg || undefined,
    durationMs: ru.durationMs || undefined,
  }));

  return {
    runId: run.id,
    status: run.status as RunProgress["status"],
    phase: run.phase as RunProgress["phase"],
    phaseDetail: run.phaseDetail || undefined,
    totalUploads: run.totalItems,
    completedUploads: run.completedItems,
    failedUploads: run.failedItems,
    totalCards: run.totalCards,
    uploads,
    startedAt: run.startedAt || undefined,
    elapsedMs,
    estimatedRemainingMs,
    error: run.errorMsg || undefined,
  };
}

// ============================================
// Cancel Run
// ============================================

export async function cancelRun(
  runId: string
): Promise<{ success: boolean; error?: string }> {
  const run = await db.run.findUnique({ where: { id: runId } });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.QUEUED) {
    return { success: false, error: "Run is not active" };
  }

  // With the continuation pattern, we just mark the run as cancelled
  // The next process-next-upload call will see this and stop
  await db.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.CANCELLED,
      completedAt: new Date(),
    },
  });

  // Reset pending uploads back to PENDING analysis status
  const pendingRunUploads = await db.runUpload.findMany({
    where: { runId, status: "PENDING" },
    select: { uploadId: true },
  });

  if (pendingRunUploads.length > 0) {
    await db.upload.updateMany({
      where: { id: { in: pendingRunUploads.map((ru) => ru.uploadId) } },
      data: { analysisStatus: AnalysisStatus.PENDING },
    });
  }

  revalidatePath(`/projects/${run.projectId}`);

  return { success: true };
}

// ============================================
// Retry Failed Uploads
// ============================================

export async function retryFailedUploads(
  runId: string
): Promise<AnalyzeProjectResult> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runUploads: {
        where: { status: "FAILED" },
        select: { uploadId: true },
      },
    },
  });

  if (!run) {
    return { success: false, error: "Run not found" };
  }

  const failedUploadIds = run.runUploads.map((ru) => ru.uploadId);

  if (failedUploadIds.length === 0) {
    return { success: false, error: "No failed uploads to retry" };
  }

  // Start a new run with just the failed uploads
  return analyzeProject({
    projectId: run.projectId,
    uploadIds: failedUploadIds,
  });
}

// ============================================
// Get Active Run for Project (with Stale Detection)
// ============================================

// Stale threshold: 2 minutes without heartbeat
const STALE_THRESHOLD_MS = 2 * 60 * 1000;

export interface ActiveRunResult {
  runId: string | null;
  recoveredFromStale?: boolean;
  previousRunId?: string;
}

export async function getActiveRunForProject(
  projectId: string
): Promise<ActiveRunResult> {
  const activeRun = await db.run.findFirst({
    where: {
      projectId,
      type: RunType.ANALYZE_CARDS,
      status: { in: [RunStatus.QUEUED, RunStatus.RUNNING] },
    },
    select: { id: true, heartbeatAt: true, status: true, startedAt: true },
  });

  if (!activeRun) {
    return { runId: null };
  }

  // Check for stale run (heartbeat older than threshold)
  // For QUEUED runs that never started, check startedAt instead
  const lastActivity = activeRun.heartbeatAt || activeRun.startedAt;
  const isStale = lastActivity &&
    (Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS);

  if (isStale) {
    console.log(`[StaleDetection] Run ${activeRun.id} is stale (last activity: ${lastActivity?.toISOString()})`);

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

    // Reset pending uploads back to PENDING analysis status
    const pendingRunUploads = await db.runUpload.findMany({
      where: { runId: activeRun.id, status: "PENDING" },
      select: { uploadId: true },
    });

    if (pendingRunUploads.length > 0) {
      await db.upload.updateMany({
        where: { id: { in: pendingRunUploads.map((ru) => ru.uploadId) } },
        data: { analysisStatus: AnalysisStatus.PENDING },
      });
    }

    return {
      runId: null,
      recoveredFromStale: true,
      previousRunId: activeRun.id,
    };
  }

  return { runId: activeRun.id };
}

// ============================================
// Get Pending Upload Count
// ============================================

export async function getPendingUploadCount(projectId: string): Promise<number> {
  return db.upload.count({
    where: {
      projectId,
      extractionStatus: ExtractionStatus.EXTRACTED,
      analysisStatus: { in: [AnalysisStatus.PENDING, AnalysisStatus.FAILED] },
    },
  });
}
