// ============================================
// Cron Job: Recover Stale Runs
// GET /api/cron/recover-stale-runs
// ============================================
// Finds runs stuck in RUNNING state and attempts recovery.
// Configure as Vercel Cron Job to run every 5 minutes.
//
// vercel.json addition:
// {
//   "crons": [{
//     "path": "/api/cron/recover-stale-runs",
//     "schedule": "*/5 * * * *"
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import {
  recoverAllStaleRuns,
  getRunHealthStatus,
  logEvent,
} from "@/lib/observability";

// Vercel cron jobs use GET requests
export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute max for cron job

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  // In production, this header is added by Vercel
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logEvent("warn", "cron.unauthorized", {
      path: "/api/cron/recover-stale-runs",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logEvent("info", "cron.started", {
      job: "recover-stale-runs",
    });

    // Get current health status
    const healthBefore = await getRunHealthStatus();

    // Attempt recovery
    const recoveryResult = await recoverAllStaleRuns();

    // Get health status after recovery
    const healthAfter = await getRunHealthStatus();

    logEvent("info", "cron.completed", {
      job: "recover-stale-runs",
      result: {
        staleRunsFound: recoveryResult.totalFound,
        recovered: recoveryResult.recovered,
        failed: recoveryResult.failed,
        healthyBefore: healthBefore.healthy,
        healthyAfter: healthAfter.healthy,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      health: {
        before: healthBefore,
        after: healthAfter,
      },
      recovery: {
        totalFound: recoveryResult.totalFound,
        recovered: recoveryResult.recovered,
        failed: recoveryResult.failed,
        details: recoveryResult.details,
      },
    });
  } catch (error) {
    logEvent("error", "cron.failed", {
      job: "recover-stale-runs",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Recovery failed",
      },
      { status: 500 }
    );
  }
}
