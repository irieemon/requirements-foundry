// ============================================
// Subtask Progress API Route
// GET /api/runs/[id]/subtask-progress - Get subtask generation progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getBatchSubtaskProgress } from "@/server/actions/subtasks";

// Cache headers to prevent stale progress data
const CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const progress = await getBatchSubtaskProgress(id);

    if (!progress) {
      return NextResponse.json(
        { error: "Run not found or not a subtask generation run" },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Debug logging for progress polling diagnostics
    console.log(`[Subtask Progress ${id}] status=${progress.status} phase=${progress.phase} completed=${progress.completedStories}/${progress.totalStories}`);

    return NextResponse.json(progress, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[Subtask Progress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get progress" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
