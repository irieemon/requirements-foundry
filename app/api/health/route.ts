import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    aiEnabled: !!process.env.ANTHROPIC_API_KEY,
  });
}
