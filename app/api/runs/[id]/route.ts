// ============================================
// Run Progress API Route
// GET /api/runs/[id] - Poll run progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getRunProgress } from "@/server/actions/analysis";

// Force Node.js runtime
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const progress = await getRunProgress(id);

    if (!progress) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Set cache headers for polling
    return NextResponse.json(progress, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Get run progress error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get run progress" },
      { status: 500 }
    );
  }
}
