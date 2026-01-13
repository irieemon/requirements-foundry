// ============================================
// Batch Story Progress API Route
// GET /api/runs/[id]/batch-story - Get batch story generation progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getBatchStoryProgress } from "@/server/actions/batch-stories";

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

    const progress = await getBatchStoryProgress(id);

    if (!progress) {
      return NextResponse.json(
        { error: "Run not found or not a batch story run" },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Debug logging for progress polling diagnostics
    console.log(`[BatchStory Progress ${id}] status=${progress.status} phase=${progress.phase} completed=${progress.completedEpics}/${progress.totalEpics}`);

    return NextResponse.json(progress, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[BatchStory Progress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get progress" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
