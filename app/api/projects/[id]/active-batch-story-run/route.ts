// ============================================
// Active Batch Story Run Check API Route
// GET /api/projects/[id]/active-batch-story-run - Check for active batch story generation run
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getActiveBatchStoryRun } from "@/server/actions/batch-stories";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await getActiveBatchStoryRun(id);

    return NextResponse.json({
      runId: result?.runId || null,
    });
  } catch (error) {
    console.error("Get active batch story run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check active run" },
      { status: 500 }
    );
  }
}
