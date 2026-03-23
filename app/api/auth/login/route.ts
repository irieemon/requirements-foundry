import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";
import type { SessionData } from "@/lib/auth/types";

/**
 * Email-only login handler (temporary until Okta SAML is configured).
 * Accepts an email address and creates a session without password verification.
 * The email is used as the user identity (sub and userId).
 *
 * TODO: Remove this route when Okta SAML is configured and Cognito OAuth is active.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  const name = email.split("@")[0].replace(/[._-]/g, " ");

  session.user = {
    sub: `email|${email}`,
    email,
    name,
    groups: [],
  };
  session.refreshToken = "";
  session.expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days

  await session.save();

  const returnTo = body.returnTo || "/projects";
  return NextResponse.json({ redirectTo: returnTo });
}
