import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";
import { buildLogoutUrl } from "@/lib/auth/cognito";
import type { SessionData } from "@/lib/auth/types";

/**
 * Logout handler.
 * Destroys the encrypted session cookie and redirects to the Cognito
 * logout endpoint. This clears the Cognito session but does NOT end
 * the Okta session (per user decision -- no SLO).
 */
export async function GET() {
  // Clear the encrypted session cookie
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );
  session.destroy();

  // Redirect to Cognito logout endpoint (clears Cognito session only)
  const logoutUrl = buildLogoutUrl();
  return NextResponse.redirect(logoutUrl);
}
