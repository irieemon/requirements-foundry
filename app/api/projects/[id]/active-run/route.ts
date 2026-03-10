// ============================================
// Active Run Check API Route
// GET /api/projects/[id]/active-run - Check for active analysis run
// ============================================
// Enhanced with stale run detection for Vercel serverless recovery

import { NextRequest, NextResponse } from "next/server";
import { getActiveRunForProject } from "@/server/actions/analysis";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    // Ownership check: verify user owns this project (or is admin)
    const project = await db.project.findUnique({ where: { id }, select: { userId: true } });
    if (!project || (project.userId !== user.email && !isAdmin(user.email))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await getActiveRunForProject(id);

    // Return extended response including stale recovery info
    return NextResponse.json({
      runId: result.runId,
      recoveredFromStale: result.recoveredFromStale || false,
      previousRunId: result.previousRunId || null,
    });
  } catch (error) {
    console.error("Get active run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check active run" },
      { status: 500 }
    );
  }
}
