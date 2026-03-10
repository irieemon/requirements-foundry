import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { exchangeCodeForTokens } from "@/lib/auth/cognito";
import { verifyIdToken } from "@/lib/auth/verify";
import { sessionOptions } from "@/lib/auth/session";
import type { SessionData } from "@/lib/auth/types";

/**
 * OAuth2 callback handler.
 * Exchanges the authorization code from Cognito for tokens,
 * verifies the ID token, creates an encrypted session cookie,
 * and redirects to the intended URL.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    // Exchange authorization code for tokens via Cognito token endpoint
    const tokens = await exchangeCodeForTokens(code);

    // Verify ID token signature, expiry, issuer, audience via aws-jwt-verify
    const payload = await verifyIdToken(tokens.id_token);

    // Parse groups: handle both JSON array and comma-separated string formats
    // (Phase 26 PreTokenGeneration Lambda may emit either format)
    let groups: string[] = [];
    const rawGroups = payload["custom:groups"];
    if (rawGroups) {
      if (Array.isArray(rawGroups)) {
        groups = rawGroups as string[];
      } else if (typeof rawGroups === "string") {
        try {
          const parsed = JSON.parse(rawGroups);
          groups = Array.isArray(parsed) ? parsed : [rawGroups];
        } catch {
          groups = rawGroups.split(",").map((g: string) => g.trim());
        }
      }
    }

    // Create encrypted session cookie via iron-session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions
    );

    session.refreshToken = tokens.refresh_token;
    session.expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
    session.user = {
      sub: payload.sub!,
      email: payload.email as string,
      name:
        (payload["cognito:username"] as string) ||
        (payload.email as string),
      groups,
    };
    await session.save();

    // Redirect to intended URL (from OAuth2 state param) or default to /projects
    const returnTo = state || "/projects";
    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
  }
}
