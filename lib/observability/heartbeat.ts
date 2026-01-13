// ============================================
// Heartbeat System for Run Monitoring
// ============================================
// Tracks active runs and detects stale/stuck runs
// that may have been interrupted by disconnects.
//
// NOTE: Current implementation uses startedAt + completedItems
// as a proxy for heartbeat. For a more robust solution,
// consider adding a `heartbeatAt` field to the Run model.

import { db } from "@/lib/db";
import { RunStatus, RunEpicStatus } from "@/lib/types";
import { logEvent } from "./logger";

// ============================================
// Configuration
// ============================================

// How long before a run is considered stale
// A run is stale if it's been RUNNING with no progress for this duration
export const STALE_THRESHOLD_MS = 120_000; // 2 minutes (accounts for Claude API response time)

// Maximum age for a run to be considered for recovery
export const MAX_RECOVERY_AGE_MS = 30 * 60 * 1000; // 30 minutes

// ============================================
// Stale Run Detection
// ============================================

export interface StaleRun {
  id: string;
  projectId: string;
  startedAt: Date | null;
  createdAt: Date;
  currentItemId: string | null;
  currentItemIndex: number | null;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  lastActivityAt: Date; // Computed from various timestamps
}

/**
 * Get the last activity timestamp for a run.
 * This looks at the most recent RunEpic completion time as a proxy for heartbeat.
 */
async function getLastActivityTime(runId: string, startedAt: Date | null, createdAt: Date): Promise<Date> {
  // Find the most recently updated RunEpic
  const latestEpic = await db.runEpic.findFirst({
    where: {
      runId,
      OR: [
        { status: RunEpicStatus.COMPLETED },
        { status: RunEpicStatus.FAILED },
        { status: RunEpicStatus.SKIPPED },
        { status: RunEpicStatus.GENERATING },
      ],
    },
    orderBy: [
      { completedAt: "desc" },
      { startedAt: "desc" },
    ],
    select: {
      completedAt: true,
      startedAt: true,
    },
  });

  // Use the most recent timestamp we can find
  if (latestEpic?.completedAt) {
    return latestEpic.completedAt;
  }
  if (latestEpic?.startedAt) {
    return latestEpic.startedAt;
  }
  if (startedAt) {
    return startedAt;
  }
  return createdAt;
}

/**
 * Find all runs that are marked as RUNNING but appear stale.
 * These may be stuck due to client disconnects or crashes.
 */
export async function findStaleRuns(): Promise<StaleRun[]> {
  const maxAge = new Date(Date.now() - MAX_RECOVERY_AGE_MS);

  // Find runs that are in RUNNING state
  const runningRuns = await db.run.findMany({
    where: {
      status: RunStatus.RUNNING,
      startedAt: { gt: maxAge }, // Don't recover very old runs
    },
    select: {
      id: true,
      projectId: true,
      startedAt: true,
      createdAt: true,
      currentItemId: true,
      currentItemIndex: true,
      totalItems: true,
      completedItems: true,
      failedItems: true,
    },
  });

  const staleRuns: StaleRun[] = [];
  const staleThreshold = Date.now() - STALE_THRESHOLD_MS;

  for (const run of runningRuns) {
    const lastActivityAt = await getLastActivityTime(run.id, run.startedAt, run.createdAt);

    // Check if the run is stale (no activity for STALE_THRESHOLD_MS)
    if (lastActivityAt.getTime() < staleThreshold) {
      staleRuns.push({
        ...run,
        lastActivityAt,
      });
    }
  }

  return staleRuns;
}

/**
 * Check if a specific run is stale.
 */
export async function isRunStale(runId: string): Promise<boolean> {
  const run = await db.run.findUnique({
    where: { id: runId },
    select: { status: true, startedAt: true, createdAt: true },
  });

  if (!run || run.status !== RunStatus.RUNNING) {
    return false;
  }

  const lastActivityAt = await getLastActivityTime(runId, run.startedAt, run.createdAt);
  const staleThreshold = Date.now() - STALE_THRESHOLD_MS;

  return lastActivityAt.getTime() < staleThreshold;
}

/**
 * Calculate how long a run has been stale.
 */
export function getStaleDuration(lastActivityAt: Date): number {
  const staleDuration = Date.now() - lastActivityAt.getTime() - STALE_THRESHOLD_MS;
  return Math.max(0, staleDuration);
}

/**
 * Check if a heartbeat timestamp is stale.
 */
export function isHeartbeatStale(lastHeartbeat: Date | null): boolean {
  if (!lastHeartbeat) return true;
  return Date.now() - lastHeartbeat.getTime() > STALE_THRESHOLD_MS;
}

// ============================================
// Stale Run Recovery
// ============================================

export interface RecoveryResult {
  success: boolean;
  action: "continued" | "finalized" | "failed" | "none";
  message: string;
}

/**
 * Attempt to recover a stale run by re-triggering processing
 * or finalizing it if all work is complete.
 */
export async function recoverStaleRun(runId: string): Promise<RecoveryResult> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: {
      runEpics: {
        select: { id: true, status: true },
      },
    },
  });

  if (!run) {
    return { success: false, action: "none", message: "Run not found" };
  }

  if (run.status !== RunStatus.RUNNING) {
    return { success: false, action: "none", message: `Run is not in RUNNING state (current: ${run.status})` };
  }

  // Check for pending epics
  const pendingEpics = run.runEpics.filter((e) => e.status === RunEpicStatus.PENDING);
  const generatingEpics = run.runEpics.filter((e) => e.status === RunEpicStatus.GENERATING);

  const lastActivityAt = await getLastActivityTime(runId, run.startedAt, run.createdAt);

  logEvent("info", "stale_run.recovery_started", {
    runId,
    pendingCount: pendingEpics.length,
    generatingCount: generatingEpics.length,
    staleDurationMs: getStaleDuration(lastActivityAt),
  });

  // If there's an epic stuck in GENERATING, reset it to PENDING
  if (generatingEpics.length > 0) {
    await db.runEpic.updateMany({
      where: {
        runId,
        status: RunEpicStatus.GENERATING,
      },
      data: {
        status: RunEpicStatus.PENDING,
        startedAt: null,
      },
    });

    logEvent("info", "stale_run.reset_generating_epics", {
      runId,
      count: generatingEpics.length,
    });
  }

  // Check again for pending epics after reset
  const pendingAfterReset = await db.runEpic.count({
    where: { runId, status: RunEpicStatus.PENDING },
  });

  if (pendingAfterReset > 0) {
    // Trigger continuation
    try {
      const { triggerProcessNext } = await import("@/lib/run-engine/process-next-trigger");
      triggerProcessNext(runId);

      logEvent("info", "stale_run.continuation_triggered", {
        runId,
        pendingEpics: pendingAfterReset,
      });

      return {
        success: true,
        action: "continued",
        message: `Triggered continuation for ${pendingAfterReset} pending epic(s)`,
      };
    } catch (error) {
      logEvent("error", "stale_run.continuation_failed", {
        runId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        action: "failed",
        message: `Failed to trigger continuation: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // No pending epics - the run should be finalized
  // This is a fallback; normally the last process-next call handles this
  logEvent("warn", "stale_run.no_pending_epics", {
    runId,
    message: "Run appears complete but was not finalized",
  });

  return {
    success: true,
    action: "none",
    message: "No pending epics; run may need manual finalization",
  };
}

// ============================================
// Batch Recovery
// ============================================

export interface BatchRecoveryResult {
  totalFound: number;
  recovered: number;
  failed: number;
  details: Array<{ runId: string; result: RecoveryResult }>;
}

/**
 * Find and attempt to recover all stale runs.
 * Intended for use in a cron job or health check.
 */
export async function recoverAllStaleRuns(): Promise<BatchRecoveryResult> {
  const staleRuns = await findStaleRuns();

  logEvent("info", "batch_recovery.started", {
    staleRunCount: staleRuns.length,
  });

  const results: Array<{ runId: string; result: RecoveryResult }> = [];
  let recovered = 0;
  let failed = 0;

  for (const run of staleRuns) {
    const result = await recoverStaleRun(run.id);
    results.push({ runId: run.id, result });

    if (result.success && result.action === "continued") {
      recovered++;
    } else if (!result.success) {
      failed++;
    }

    // Small delay between recovery attempts to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logEvent("info", "batch_recovery.completed", {
    totalFound: staleRuns.length,
    recovered,
    failed,
  });

  return {
    totalFound: staleRuns.length,
    recovered,
    failed,
    details: results,
  };
}

// ============================================
// Health Check
// ============================================

export interface HealthStatus {
  healthy: boolean;
  staleRunCount: number;
  oldestStaleRun?: {
    runId: string;
    staleDurationMs: number;
  };
}

/**
 * Check the health of the run processing system.
 */
export async function getRunHealthStatus(): Promise<HealthStatus> {
  const staleRuns = await findStaleRuns();

  if (staleRuns.length === 0) {
    return { healthy: true, staleRunCount: 0 };
  }

  // Find the oldest stale run
  const oldestRun = staleRuns.reduce((oldest, current) => {
    const oldestTime = oldest.lastActivityAt.getTime();
    const currentTime = current.lastActivityAt.getTime();
    return currentTime < oldestTime ? current : oldest;
  });

  return {
    healthy: false,
    staleRunCount: staleRuns.length,
    oldestStaleRun: {
      runId: oldestRun.id,
      staleDurationMs: getStaleDuration(oldestRun.lastActivityAt),
    },
  };
}

// ============================================
// Heartbeat Update (for future schema enhancement)
// ============================================

/**
 * Placeholder for heartbeat update when heartbeatAt field is added.
 * Currently, the system uses RunEpic timestamps as a proxy.
 *
 * To enable proper heartbeat tracking, add to schema.prisma:
 *
 * model Run {
 *   // ... existing fields ...
 *   heartbeatAt DateTime?  // Last heartbeat timestamp
 * }
 *
 * Then implement:
 * export async function updateHeartbeat(runId: string): Promise<void> {
 *   await db.run.update({
 *     where: { id: runId },
 *     data: { heartbeatAt: new Date() }
 *   });
 * }
 */
export async function updateHeartbeat(runId: string): Promise<void> {
  // Currently a no-op since heartbeatAt field doesn't exist
  // The system uses RunEpic completion times as a proxy
  logEvent("info", "heartbeat.updated", { runId });
}
