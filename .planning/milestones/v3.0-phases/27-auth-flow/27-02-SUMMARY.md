---
phase: 27-auth-flow
plan: 02
subsystem: auth
tags: [proxy, oauth2, callback, logout, iron-session, cognito, jwt, route-protection]

# Dependency graph
requires:
  - phase: 27-auth-flow
    plan: 01
    provides: lib/auth/ module (cognito.ts, verify.ts, session.ts, types.ts) with URL builders, JWT verification, session management
provides:
  - proxy.ts route protection interceptor for all non-public routes
  - /api/auth/callback OAuth2 code exchange and session creation
  - /api/auth/logout session destruction and Cognito logout redirect
  - Transparent token refresh on near-expiry sessions
affects: [27-03 (landing page), 28-data-isolation]

# Tech tracking
tech-stack:
  added: []
  patterns: [proxy.ts Node.js runtime route protection, getIronSession with request/response cookies in proxy context, group claim parsing for both JSON array and comma-separated formats]

key-files:
  created: [proxy.ts, app/api/auth/callback/route.ts, app/api/auth/logout/route.ts, __tests__/proxy.test.ts]
  modified: []

key-decisions:
  - "Use getIronSession with request.cookies/response.cookies pattern in proxy.ts (not cookies() helper which is for server components)"
  - "5-minute refresh threshold for transparent token refresh in proxy"
  - "Failed refresh redirects to / for silent re-auth via Cognito/Okta SSO (no error page)"

patterns-established:
  - "proxy.ts public route check: exact match for / plus prefix match for /api/health, /api/cron/, /api/auth/, /_next/, /favicon.ico"
  - "Group claim parsing: try JSON.parse first, fallback to comma-split -- consistent with Phase 26 Lambda behavior"
  - "Callback route uses cookies() from next/headers; proxy.ts uses request.cookies/response.cookies -- different iron-session patterns for different contexts"

requirements-completed: [AUTH-01, AUTH-04, AUTH-05]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 27 Plan 02: Route Protection & Auth Routes Summary

**proxy.ts route interceptor with transparent token refresh, OAuth2 callback for session creation, and Cognito logout handler with 13 unit tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T15:06:44Z
- **Completed:** 2026-03-10T15:09:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- proxy.ts intercepts all non-public routes, verifies sessions via iron-session, and transparently refreshes near-expiry tokens
- /api/auth/callback exchanges Cognito authorization codes for verified JWT claims and creates encrypted session cookies
- /api/auth/logout destroys session cookie and redirects through Cognito logout endpoint (clears Cognito session only, not Okta)
- 13 unit tests covering public route bypass, unauthenticated redirect, authenticated pass-through, token refresh, and failure cases

## Task Commits

Each task was committed atomically:

1. **Task 1: proxy.ts route protection (TDD RED)** - `2fdcb60` (test)
2. **Task 1: proxy.ts route protection (TDD GREEN)** - `83b7265` (feat)
3. **Task 2: OAuth2 callback and logout API routes** - `5123fd1` (feat)

_Note: Task 1 used TDD with separate RED and GREEN commits._

## Files Created/Modified
- `proxy.ts` - Route protection interceptor: public route bypass, session verification, transparent token refresh, unauthenticated redirect
- `__tests__/proxy.test.ts` - 13 unit tests for proxy route matching, auth logic, and refresh behavior
- `app/api/auth/callback/route.ts` - OAuth2 code exchange, ID token verification, session creation, returnTo redirect
- `app/api/auth/logout/route.ts` - Session destruction and Cognito logout redirect

## Decisions Made
- Use `getIronSession(request.cookies, response.cookies, options)` pattern in proxy.ts for request/response context (different from `cookies()` pattern used in server components and API routes)
- 5-minute (300 second) refresh threshold -- triggers transparent refresh when session expires within this window
- Failed token refresh silently redirects to / rather than showing an error page -- if Okta session is active, user gets new tokens seamlessly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. All routes use existing lib/auth/ module and environment variables from Phase 26.

## Next Phase Readiness
- Full auth flow operational: proxy.ts protects routes, callback creates sessions, logout clears sessions
- Ready for Plan 03: landing page with "Sign in with Okta" button and conditional AppShell layout
- Phase 28 (data isolation) can now use getCurrentUser() for per-user data scoping

---
*Phase: 27-auth-flow*
*Completed: 2026-03-10*
