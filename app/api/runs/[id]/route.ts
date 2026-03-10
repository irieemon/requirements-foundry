// ============================================
// Run Progress API Route
// GET /api/runs/[id] - Poll run progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getRunProgress } from "@/server/actions/analysis";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

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
    const user = await getCurrentUser();
    const { id } = await params;

    // Ownership check: verify run belongs to a project the user owns (or is admin)
    const run = await db.run.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });
    if (!run || (run.project.userId !== user.email && !isAdmin(user.email))) {
      return NextResponse.json({ error: "Run not found" }, { status: 404, headers: CACHE_HEADERS });
    }

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
