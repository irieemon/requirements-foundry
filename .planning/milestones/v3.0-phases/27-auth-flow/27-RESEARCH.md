# Phase 27: Auth Flow - Research

**Researched:** 2026-03-10
**Domain:** Authentication (Cognito OAuth2 + Next.js 16 proxy + JWT verification + cookie sessions)
**Confidence:** HIGH

## Summary

This phase implements end-to-end authentication using AWS Cognito as the OAuth2 provider with Okta as the federated SAML identity provider. The flow is: landing page -> Cognito authorize endpoint (with `identity_provider=Okta` to skip hosted UI) -> Okta SSO -> callback with auth code -> token exchange -> encrypted HTTP-only cookie -> proxy.ts route protection.

The project runs Next.js 16.1.1, which deprecates `middleware.ts` in favor of `proxy.ts`. This is significant because `proxy.ts` runs on the Node.js runtime (not Edge), giving full access to Node.js crypto APIs and `aws-jwt-verify`. The stack uses `aws-jwt-verify` for Cognito-specific JWT verification (with built-in JWKS caching) and `iron-session` for encrypted cookie management.

No existing auth infrastructure exists in the codebase. The current `app/page.tsx` redirects to `/projects` and the root layout wraps everything in `AppShell`. Both need modification: the landing page replaces the redirect, and the layout must conditionally render `AppShell` based on auth state.

**Primary recommendation:** Use `proxy.ts` (Next.js 16 pattern) with `aws-jwt-verify` for JWT validation and `iron-session` for encrypted cookie sessions. Direct Cognito OAuth2 flow with `identity_provider=Okta` parameter -- no NextAuth, no Amplify.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Landing page: Minimal and clean with app name, tagline, single "Sign in with Okta" button at root route (/)
- Landing page: Standalone design, no AppShell sidebar/header visible; full-page centered login card
- Button goes directly to Okta (bypasses Cognito Hosted UI) using `identity_provider=Okta` parameter
- Deep link preservation: store intended URL before redirect, return user there after login
- Route protection via Next.js middleware/proxy (intercepts all requests before rendering)
- Public routes exempted: /api/health, /api/cron/*, and root (/) landing page
- On session expiry: silent re-auth via Cognito/Okta SSO redirect
- Encrypted HTTP-only cookie stores ID token + refresh token (no server-side session store)
- Middleware auto-refresh: check token expiry on each request, use refresh token transparently
- getSession() / getCurrentUser() helper for server components and actions
- Full JWKS verification on every request with cached public keys
- Full Cognito logout: redirect to Cognito /logout endpoint, clears Cognito session
- Do NOT end Okta session (no SLO); user stays logged into other corporate apps
- After logout, redirect to landing page (/)
- New API route needed: /api/auth/callback for OAuth code exchange

### Claude's Discretion
- Cookie encryption approach and key management
- JWKS cache TTL duration
- Token refresh threshold (exact minutes before expiry)
- Error handling for failed token refresh
- Loading states during auth redirects

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in via Okta SAML SSO with seamless redirect | Cognito authorize endpoint with `identity_provider=Okta` bypasses hosted UI; if Okta session active, returns transparently |
| AUTH-02 | Unauthenticated user sees a public landing page with "Sign in with Okta" button | Landing page at `/` with standalone layout (no AppShell); button constructs Cognito authorize URL |
| AUTH-03 | User session persists via HTTP-only cookies with automatic refresh | iron-session encrypted cookies; proxy.ts checks expiry and refreshes via Cognito token endpoint |
| AUTH-04 | User can log out and is redirected to the landing page | Cognito /logout endpoint with `logout_uri` pointing to app root; clear session cookie |
| AUTH-05 | All app routes are protected -- unauthenticated requests redirect to landing page | proxy.ts matcher excludes public routes; all others verified via aws-jwt-verify |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `aws-jwt-verify` | ^5.1.1 | Cognito JWT verification with JWKS caching | AWS-maintained, purpose-built for Cognito, auto-handles key rotation, Node.js 18+ |
| `iron-session` | ^8.x | Encrypted HTTP-only cookie sessions | Stateless, zero-config encryption, works with Next.js App Router server components/actions |
| `jose` | ^6.x | JWT decoding for claims inspection (backup) | Edge-compatible, zero-dependency, Web Crypto API based -- useful if jose is ever needed in client |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | (already installed) | Prevent auth helpers from being imported client-side | Always import in `lib/auth/` modules |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `aws-jwt-verify` | `jose` + manual JWKS | jose is more generic; aws-jwt-verify handles Cognito-specific claims (token_use, iss format) automatically |
| `iron-session` | Manual AES-GCM encryption | iron-session handles key rotation, seal format, cookie options -- no reason to hand-roll |
| NextAuth / Auth.js | Direct Cognito OAuth2 | Out of scope per REQUIREMENTS.md; direct integration is simpler for SAML |
| Amplify | Direct Cognito OAuth2 | Out of scope per REQUIREMENTS.md; heavy SDK for a simple auth code flow |

**Installation:**
```bash
npm install aws-jwt-verify iron-session
```

Note: `jose` is NOT needed if using `aws-jwt-verify` for all verification. Only install if JWT decoding is needed separately.

## Architecture Patterns

### Recommended Project Structure
```
lib/
  auth/
    index.ts              # Re-exports getSession, getCurrentUser
    session.ts            # iron-session config + getSession()
    cognito.ts            # Cognito URL builders (authorize, token, logout)
    verify.ts             # aws-jwt-verify singleton + verify function
    types.ts              # SessionData, UserInfo interfaces
app/
  page.tsx                # Landing page (public, no AppShell)
  layout.tsx              # Conditional AppShell based on route/auth
  api/
    auth/
      callback/route.ts   # OAuth2 code exchange + set cookie
      logout/route.ts     # Clear cookie + redirect to Cognito logout
proxy.ts                  # Root-level proxy (was middleware.ts)
```

### Pattern 1: proxy.ts (Next.js 16 -- replaces middleware.ts)
**What:** Request interceptor that runs on Node.js runtime before route rendering
**When to use:** Every request that needs auth verification
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function proxy(request: NextRequest) {
  const session = await getSession(request);

  if (!session.idToken) {
    // Store intended URL for post-login redirect
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT and check expiry
  // If near-expiry, refresh tokens transparently
  // Pass user info via headers to server components

  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: [
    // Match all routes except public ones
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/cron).*)',
  ],
};
```

### Pattern 2: Cognito OAuth2 Authorize URL Construction
**What:** Build the authorize URL that skips Cognito hosted UI and goes directly to Okta
**When to use:** "Sign in with Okta" button click
**Example:**
```typescript
// Source: https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html
export function buildAuthorizeUrl(returnTo?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.COGNITO_CLIENT_ID!,
    redirect_uri: process.env.COGNITO_REDIRECT_URI!,
    scope: 'openid profile email',
    identity_provider: 'Okta',
    state: returnTo || '/',
  });
  return `https://${process.env.COGNITO_DOMAIN}/oauth2/authorize?${params}`;
}
```

### Pattern 3: Token Exchange (Authorization Code -> Tokens)
**What:** Server-side exchange of auth code for ID/access/refresh tokens
**When to use:** `/api/auth/callback` route handler
**Example:**
```typescript
// Source: https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
export async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.COGNITO_REDIRECT_URI!,
    client_id: process.env.COGNITO_CLIENT_ID!,
    client_secret: process.env.COGNITO_CLIENT_SECRET!,
  });

  const response = await fetch(
    `https://${process.env.COGNITO_DOMAIN}/oauth2/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }
  );

  return response.json();
  // Returns: { id_token, access_token, refresh_token, token_type, expires_in }
}
```

### Pattern 4: Cognito Logout URL
**What:** Redirect to Cognito logout endpoint (clears Cognito session, NOT Okta session)
**When to use:** User clicks logout
**Example:**
```typescript
// Source: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html
export function buildLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.COGNITO_CLIENT_ID!,
    logout_uri: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  });
  return `https://${process.env.COGNITO_DOMAIN}/logout?${params}`;
}
```

### Pattern 5: iron-session Configuration
**What:** Encrypted cookie session management
**When to use:** Storing tokens in HTTP-only cookies
**Example:**
```typescript
// Source: https://github.com/vvo/iron-session
import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  idToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  user: {
    sub: string;
    email: string;
    name: string;
    groups: string[];
  };
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!, // min 32 chars
  cookieName: 'rf-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days (refresh token lifetime)
  },
};

// For server components / server actions
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
```

### Pattern 6: JWT Verification with aws-jwt-verify
**What:** Verify Cognito JWTs with automatic JWKS caching
**When to use:** proxy.ts on every request
**Example:**
```typescript
// Source: https://github.com/awslabs/aws-jwt-verify
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Singleton -- JWKS cached automatically
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function verifyIdToken(token: string) {
  return verifier.verify(token);
}
```

### Anti-Patterns to Avoid
- **Storing tokens in localStorage:** Vulnerable to XSS. Use HTTP-only cookies only.
- **Verifying JWTs only in middleware/proxy:** CVE-2025-29927 showed middleware can be bypassed. Also verify in the Data Access Layer (server actions, API routes).
- **Using Edge runtime with Node.js-dependent libraries:** `proxy.ts` in Next.js 16 uses Node.js runtime, solving this. Do NOT set `runtime: 'edge'` in proxy config.
- **Passing full JWTs to client components:** Only pass derived user info (email, name, groups), never raw tokens.
- **Hardcoding Cognito domain/client IDs:** Always use environment variables available in ECS container.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie encryption | Custom AES-GCM + HMAC | `iron-session` | Handles seal format, key rotation, timing-safe comparison |
| JWT verification | Manual JWKS fetch + cache + verify | `aws-jwt-verify` | Handles key rotation, caching, Cognito-specific claim validation |
| CSRF protection | Custom state parameter generation | `crypto.randomUUID()` + state param | OAuth2 state parameter is the standard CSRF guard for auth flows |
| Token refresh logic | Custom timer/interval | Check in proxy.ts per-request | Avoids stale client-side timers; server-side check is authoritative |

**Key insight:** The Cognito OAuth2 flow has many subtle requirements (PKCE vs client_secret, token_use validation, issuer format validation, JWKS key rotation). `aws-jwt-verify` handles all of these. Rolling your own verification invites security bugs.

## Common Pitfalls

### Pitfall 1: middleware.ts vs proxy.ts in Next.js 16
**What goes wrong:** Using deprecated `middleware.ts` instead of `proxy.ts`
**Why it happens:** Most tutorials and examples still reference `middleware.ts`
**How to avoid:** Use `proxy.ts` with `export function proxy(request)`. The file must be at the project root (same level as `app/`). Next.js 16 deprecated `middleware.ts`; `proxy.ts` runs on Node.js runtime.
**Warning signs:** Edge runtime errors about missing Node.js APIs

### Pitfall 2: Cookie Size Limits
**What goes wrong:** Cognito ID tokens can be large (especially with custom claims/groups), and encrypted cookies add overhead. Browsers enforce ~4096 byte cookie limits.
**Why it happens:** ID token + refresh token + encryption overhead can exceed 4KB
**How to avoid:** Store only essential claims in the session (sub, email, name, groups) plus the refresh token. Do NOT store the full ID token in the cookie. Instead, verify the ID token during callback, extract claims, store claims + refresh token.
**Warning signs:** Silent cookie failures, session appearing empty

### Pitfall 3: Proxy Bypass (CVE-2025-29927)
**What goes wrong:** Middleware/proxy alone is insufficient for security; attackers can bypass it
**Why it happens:** Next.js middleware runs before routes but can be bypassed in certain configurations
**How to avoid:** Defense in depth -- verify auth in proxy.ts AND in the Data Access Layer. `getSession()` should be called in server actions and API routes too, not just proxy.
**Warning signs:** Unauthenticated requests reaching server actions

### Pitfall 4: Token Refresh Race Conditions
**What goes wrong:** Multiple concurrent requests all try to refresh tokens simultaneously
**Why it happens:** Browser opens multiple tabs or makes parallel API calls
**How to avoid:** Use a short "refresh buffer" (e.g., refresh when < 5 minutes to expiry). If refresh fails, redirect to re-auth rather than looping. The Cognito token endpoint is idempotent with the same refresh token.
**Warning signs:** 401 errors in parallel requests, Cognito rate limiting

### Pitfall 5: State Parameter for Deep Links and CSRF
**What goes wrong:** User loses their intended destination after SSO redirect, or CSRF vulnerability
**Why it happens:** Not encoding the return URL in the OAuth2 `state` parameter
**How to avoid:** Use `state` parameter to encode the return URL. Validate state on callback to prevent CSRF. Use `crypto.randomUUID()` + URL encoding.
**Warning signs:** Users always landing on `/projects` after login instead of their original URL

### Pitfall 6: AppShell Rendering on Landing Page
**What goes wrong:** Landing page shows the sidebar/navigation from AppShell
**Why it happens:** Root layout.tsx wraps all children in AppShell unconditionally
**How to avoid:** Restructure layouts. Use a route group `(authenticated)` for routes with AppShell, and keep landing page outside it. Or conditionally render AppShell based on pathname.
**Warning signs:** Landing page showing sidebar/header

### Pitfall 7: Cognito Logout Does Not Clear Okta Session
**What goes wrong:** After logout, clicking "Sign in with Okta" immediately logs user back in
**Why it happens:** By design -- the user decision explicitly says "do NOT end Okta session"
**How to avoid:** This is expected behavior. The Cognito session is cleared, but Okta SSO session remains. If the user clicks sign in again, they'll be seamlessly re-authenticated. This is the correct corporate SSO behavior.

## Code Examples

### Complete Callback Route Handler
```typescript
// app/api/auth/callback/route.ts
// Source: Cognito OAuth2 token endpoint docs
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/auth/cognito';
import { verifyIdToken } from '@/lib/auth/verify';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Verify ID token and extract claims
    const payload = await verifyIdToken(tokens.id_token);

    // Store session data in encrypted cookie
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
    session.refreshToken = tokens.refresh_token;
    session.expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
    session.user = {
      sub: payload.sub!,
      email: payload.email as string,
      name: payload['cognito:username'] as string || payload.email as string,
      groups: (payload['custom:groups'] as string[] ) || [],
    };
    await session.save();

    // Redirect to intended URL (from state) or default
    const returnTo = state || '/projects';
    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }
}
```

### getCurrentUser() Helper
```typescript
// lib/auth/index.ts
import 'server-only';
import { getSession } from './session';
import { redirect } from 'next/navigation';

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  groups: string[];
}

export async function getCurrentUser(): Promise<UserInfo> {
  const session = await getSession();
  if (!session.user) {
    redirect('/');
  }
  return session.user;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 (Oct 2025) | Node.js runtime, clearer naming, deprecated middleware |
| Edge runtime for middleware | Node.js runtime for proxy | Next.js 16 | Can use `aws-jwt-verify`, `iron-session`, Node crypto |
| `jsonwebtoken` npm | `jose` / `aws-jwt-verify` | 2024+ | jose works in all runtimes; aws-jwt-verify is Cognito-specific |
| Middleware-only auth | Defense in depth (proxy + DAL) | CVE-2025-29927 | Must verify auth at data access layer too |
| NextAuth/Auth.js | Direct OAuth2 for SAML/Cognito | Project decision | Simpler, fewer abstractions for federated SAML |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16, use `proxy.ts`
- `jsonwebtoken`: Requires Node.js crypto, not Edge-compatible (less relevant now with proxy.ts Node.js runtime, but aws-jwt-verify is still preferred for Cognito)
- Cognito Hosted UI: Bypassed by design using `identity_provider=Okta` parameter

## Open Questions

1. **SESSION_SECRET environment variable**
   - What we know: iron-session requires a 32+ character password for cookie encryption
   - What's unclear: Whether this should be stored in Secrets Manager alongside RDS creds, or as a plain ECS environment variable
   - Recommendation: Store in Secrets Manager for production; load in entrypoint.js alongside RDS secret. Use a random 64-character hex string. For dev, use `.env.local`.

2. **Custom claims format from PreTokenGeneration Lambda**
   - What we know: Phase 26 PreTokenGeneration Lambda maps Okta groups to JWT claims, handling both JSON array and comma-separated formats
   - What's unclear: Exact claim key name in the ID token (likely `custom:groups` based on Cognito conventions)
   - Recommendation: Test with actual Cognito tokens after Phase 26 deployment. Code should handle both `custom:groups` and `cognito:groups`.

3. **Next.js 16 proxy.ts standalone output**
   - What we know: The project uses `output: "standalone"` in next.config.ts for Docker deployment
   - What's unclear: Whether proxy.ts is properly included in standalone output (it should be, as middleware.ts was)
   - Recommendation: Verify during testing that proxy.ts is present in `.next/standalone/` output

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Cognito authorize URL includes identity_provider=Okta | unit | `npx vitest run lib/auth/__tests__/cognito.test.ts -t "authorize"` | Wave 0 |
| AUTH-02 | Landing page renders sign-in button | smoke | Manual (visual) or Playwright | Wave 0 |
| AUTH-03 | Session persists across requests; token refresh works | unit | `npx vitest run lib/auth/__tests__/session.test.ts` | Wave 0 |
| AUTH-04 | Logout clears cookie and builds correct Cognito logout URL | unit | `npx vitest run lib/auth/__tests__/cognito.test.ts -t "logout"` | Wave 0 |
| AUTH-05 | Proxy redirects unauthenticated; allows public routes | unit | `npx vitest run __tests__/proxy.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/auth/__tests__/cognito.test.ts` -- covers AUTH-01, AUTH-04 (URL construction)
- [ ] `lib/auth/__tests__/session.test.ts` -- covers AUTH-03 (session helpers)
- [ ] `__tests__/proxy.test.ts` -- covers AUTH-05 (route protection logic)
- [ ] Vitest config may need `include` pattern update to cover `lib/auth/__tests__` and root `__tests__`

## Sources

### Primary (HIGH confidence)
- [Next.js 16 proxy.ts docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) -- proxy function signature, matcher, cookies, Node.js runtime
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) -- middleware deprecation, proxy.ts introduction
- [Cognito authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html) -- identity_provider parameter, authorize URL format
- [Cognito token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html) -- code exchange parameters, response format
- [Cognito logout endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html) -- logout_uri vs redirect_uri
- [aws-jwt-verify GitHub](https://github.com/awslabs/aws-jwt-verify) -- CognitoJwtVerifier API, JWKS caching
- [iron-session GitHub](https://github.com/vvo/iron-session) -- session options, Next.js App Router support

### Secondary (MEDIUM confidence)
- [jose npm](https://www.npmjs.com/package/jose) -- v6.x, createRemoteJWKSet + jwtVerify for edge-compatible JWT verification
- [CVE-2025-29927 discussion](https://dev.to/leapcell/implementing-jwt-middleware-in-nextjs-a-complete-guide-to-auth-1b2d) -- defense-in-depth pattern for auth

### Tertiary (LOW confidence)
- iron-session v8 compatibility with Next.js 16 proxy.ts -- no explicit confirmation found, but v8 works with App Router cookies() and should work identically in proxy.ts context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- aws-jwt-verify and iron-session are well-documented, actively maintained, and purpose-built for this use case
- Architecture: HIGH -- proxy.ts is officially documented for Next.js 16.1.1; Cognito OAuth2 flow is well-documented by AWS
- Pitfalls: HIGH -- CVE-2025-29927, cookie size limits, and the middleware->proxy migration are well-documented issues
- Cookie size concern: MEDIUM -- need to verify actual ID token size with Cognito custom claims; may need to store claims only (not full token)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable libraries, Next.js 16 is stable release)
