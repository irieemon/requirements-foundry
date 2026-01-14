// ============================================
// Active Subtask Run Check API Route
// GET /api/projects/[id]/active-subtask-run - Check for active subtask generation run
// ============================================
// Enhanced with stale run detection for Vercel serverless recovery

import { NextRequest, NextResponse } from "next/server";
import { getActiveSubtaskRun } from "@/server/actions/subtasks";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await getActiveSubtaskRun(id);

    // Return extended response including stale recovery info
    return NextResponse.json({
      runId: result.runId,
      recoveredFromStale: result.recoveredFromStale || false,
      previousRunId: result.previousRunId || null,
    });
  } catch (error) {
    console.error("Get active subtask run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check active run" },
      { status: 500 }
    );
  }
}
