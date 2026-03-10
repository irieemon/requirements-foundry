# Phase 27: Auth Flow - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end authentication flow: public landing page, Okta SSO login via Cognito, session management with HTTP-only cookies, route protection via middleware, and logout. Builds on Phase 26 Cognito infrastructure. Does NOT include per-user data isolation (Phase 28) or admin UI (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Landing page experience
- Minimal and clean: app name, brief tagline, single "Sign in with Okta" button
- Lives at root route (/) — replaces current auto-redirect to /projects
- Standalone design — no AppShell sidebar/header visible; full-page centered login card
- Button goes directly to Okta (bypasses Cognito Hosted UI) using `identity_provider=Okta` parameter in the Cognito authorize URL

### Auth redirect behavior
- Deep link preservation: store intended URL before redirect, return user there after login
- Route protection via Next.js middleware.ts (intercepts all requests before rendering)
- Public routes exempted from auth: /api/health (ALB health check), /api/cron/* (Lambda invocations), and root (/) landing page
- On session expiry: silent re-auth via Cognito/Okta SSO redirect — if Okta session is active, user gets new tokens seamlessly

### Session & cookie strategy
- Encrypted HTTP-only cookie stores ID token + refresh token (no server-side session store)
- Middleware auto-refresh: check token expiry on each request, use refresh token transparently if within 5-10 min of expiry
- getSession() / getCurrentUser() helper function for server components and actions to access typed user info (email, name, groups)
- Full JWKS verification on every request: download and cache Cognito's public keys, verify JWT signature (cache with TTL)

### Logout flow
- Full Cognito logout: redirect to Cognito /logout endpoint, clears Cognito session
- Cognito session only — do NOT end Okta session (no SLO); user stays logged into other corporate apps
- After logout, redirect to landing page (/)

### Claude's Discretion
- Cookie encryption approach and key management
- JWKS cache TTL duration
- Token refresh threshold (exact minutes before expiry)
- Error handling for failed token refresh
- Loading states during auth redirects

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/layout.tsx`: Root layout with AppShell — landing page needs to bypass AppShell
- `entrypoint.js`: Already reads Secrets Manager for RDS — same pattern for Cognito secret
- `components/layout/app-shell.tsx`: Existing shell component — authenticated routes keep using it

### Established Patterns
- Next.js App Router with `force-dynamic` rendering
- Server actions in `server/actions/` for data mutations
- API routes in `app/api/` for polling and uploads
- No existing auth pattern — this is the first auth implementation

### Integration Points
- `app/page.tsx`: Currently redirects to /projects — becomes the landing page
- `app/api/health/route.ts`: Must remain public (ALB health check)
- `app/api/cron/recover-stale-runs/route.ts`: Must remain public (Lambda invocations)
- All 9 existing API routes need auth enforcement
- All page routes need middleware protection
- Phase 26 environment: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_DOMAIN, COGNITO_REDIRECT_URI, COGNITO_CLIENT_SECRET available in ECS container
- New API route needed: `/api/auth/callback` for OAuth code exchange

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-auth-flow*
*Context gathered: 2026-03-10*
