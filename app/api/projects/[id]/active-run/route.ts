// ============================================
// Active Run Check API Route
// GET /api/projects/[id]/active-run - Check for active analysis run
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getActiveRunForProject } from "@/server/actions/analysis";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await getActiveRunForProject(id);

    return NextResponse.json({
      runId: result?.runId || null,
    });
  } catch (error) {
    console.error("Get active run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check active run" },
      { status: 500 }
    );
  }
}
