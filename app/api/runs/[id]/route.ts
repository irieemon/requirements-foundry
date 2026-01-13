// ============================================
// Run Progress API Route
// GET /api/runs/[id] - Poll run progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getRunProgress } from "@/server/actions/analysis";

// Force Node.js runtime
export const runtime = "nodejs";

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

    const progress = await getRunProgress(id);

    if (!progress) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404, headers: CACHE_HEADERS }
      );
    }

    // Debug logging for progress polling diagnostics
    console.log(`[CardAnalysis Progress ${id}] status=${progress.status} phase=${progress.phase} completed=${progress.completedUploads}/${progress.totalUploads}`);

    return NextResponse.json(progress, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[CardAnalysis Progress] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get run progress" },
      { status: 500, headers: CACHE_HEADERS }
    );
  }
}
