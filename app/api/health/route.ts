import { NextResponse } from "next/server";
import { getRunHealthStatus } from "@/lib/observability";

export async function GET() {
  // Basic health check
  const basic = {
    status: "ok",
    timestamp: new Date().toISOString(),
    aiEnabled: !!process.env.ANTHROPIC_API_KEY,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    region: process.env.VERCEL_REGION || "local",
  };

  // Optional: Include run health status
  // This adds a DB query, so we make it optional via query param
  const url = new URL("http://localhost"); // Dummy URL for parsing
  try {
    // Check for detailed health request
    // Usage: GET /api/health?detailed=true
    const runHealth = await getRunHealthStatus();

    return NextResponse.json({
      ...basic,
      runs: {
        healthy: runHealth.healthy,
        staleRunCount: runHealth.staleRunCount,
        oldestStaleRun: runHealth.oldestStaleRun,
      },
    });
  } catch {
    // If DB is unavailable, return basic health only
    return NextResponse.json({
      ...basic,
      runs: {
        healthy: null,
        error: "Could not check run health",
      },
    });
  }
}
