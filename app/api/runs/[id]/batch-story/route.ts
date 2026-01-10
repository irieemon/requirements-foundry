// ============================================
// Batch Story Progress API Route
// GET /api/runs/[id]/batch-story - Get batch story generation progress
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getBatchStoryProgress } from "@/server/actions/batch-stories";

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
        { status: 404 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Get batch story progress error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get progress" },
      { status: 500 }
    );
  }
}
