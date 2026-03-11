import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth/session";
import { refreshTokens } from "@/lib/auth/cognito";
import { verifyIdToken } from "@/lib/auth/verify";
import type { SessionData } from "@/lib/auth/types";

/**
 * Public routes that bypass auth checks entirely.
 * - / : Landing page (sign-in page for unauthenticated users)
 * - /api/health : ALB health check
 * - /api/cron/* : Lambda invocations
 * - /api/auth/* : Auth callback and logout routes
 * - /_next/* : Next.js static assets and images
 * - /favicon.ico : Browser favicon
 */
const PUBLIC_PATHS = ["/api/health", "/api/cron/", "/api/auth/", "/_next/", "/favicon.ico"];

function isPublicRoute(pathname: string): boolean {
  // Exact match for landing page
  if (pathname === "/") return true;

  // Prefix matches for public paths
  return PUBLIC_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/** Threshold in seconds before expiry to trigger transparent token refresh */
const REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Next.js 16 proxy function (replaces deprecated middleware.ts).
 * Runs on Node.js runtime (not Edge), giving access to aws-jwt-verify and iron-session.
 *
 * Responsibilities:
 * 1. Allow public routes through without auth check
 * 2. Redirect unauthenticated requests to / with returnTo parameter
 * 3. Transparently refresh near-expiry tokens
 * 4. Redirect to / on refresh failure (silent re-auth via Cognito/Okta SSO)
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Public routes pass through without any auth check
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Read session from encrypted cookie on the request
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

  // No session or no user -> redirect to landing page with returnTo
  if (!session.user) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const now = Math.floor(Date.now() / 1000);
  const timeToExpiry = session.expiresAt - now;

  // Session expired or near-expiry: attempt token refresh
  if (timeToExpiry < REFRESH_THRESHOLD_SECONDS) {
    // No refresh token available -> redirect for re-auth
    if (!session.refreshToken) {
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Transparent refresh: get new tokens from Cognito
      const tokens = await refreshTokens(session.refreshToken);
      const payload = await verifyIdToken(tokens.id_token);

      // Parse groups: handle both string[] and comma-separated string formats
      let groups: string[] = [];
      const rawGroups = payload["custom:groups"];
      if (rawGroups) {
        if (Array.isArray(rawGroups)) {
          groups = rawGroups;
        } else if (typeof rawGroups === "string") {
          try {
            const parsed = JSON.parse(rawGroups);
            groups = Array.isArray(parsed) ? parsed : [rawGroups];
          } catch {
            groups = rawGroups.split(",").map((g: string) => g.trim());
          }
        }
      }

      // Update session with new token data
      session.expiresAt = now + tokens.expires_in;
      session.user = {
        sub: payload.sub!,
        email: (payload.email as string) || session.user.email,
        name:
          (payload["cognito:username"] as string) ||
          (payload.email as string) ||
          session.user.name,
        groups,
      };
      await session.save();

      return response;
    } catch (error) {
      // Refresh failed (e.g., revoked refresh token) -> redirect for re-auth
      // Silent re-auth via Cognito/Okta SSO: if Okta session is active, user
      // gets new tokens seamlessly without seeing a login form
      console.error("Token refresh failed:", error);
      const loginUrl = new URL("/", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Valid, non-expired session -> pass through
  return response;
}

/**
 * Route matcher: excludes static files that are handled by Next.js directly.
 * Additional public route checks are done inside the proxy function.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
