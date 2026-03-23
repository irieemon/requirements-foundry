import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";
// import { buildLogoutUrl } from "@/lib/auth/cognito";
import type { SessionData } from "@/lib/auth/types";

/**
 * Logout handler.
 * Destroys the encrypted session cookie and redirects to the landing page.
 *
 * TODO: When Okta SAML is active, uncomment buildLogoutUrl() to also clear
 * the Cognito session: return NextResponse.redirect(buildLogoutUrl());
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );
  session.destroy();

  // Redirect to landing page (no Cognito session to clear in email-only mode)
  return NextResponse.redirect(new URL("/", request.url));
}
