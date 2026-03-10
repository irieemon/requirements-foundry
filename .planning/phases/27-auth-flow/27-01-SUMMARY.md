---
phase: 27-auth-flow
plan: 01
subsystem: auth
tags: [cognito, oauth2, jwt, iron-session, aws-jwt-verify, okta, cookies]

# Dependency graph
requires:
  - phase: 26-cognito-infrastructure
    provides: Cognito User Pool, app client, domain, env vars (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_DOMAIN, COGNITO_REDIRECT_URI)
provides:
  - lib/auth/ module with typed Cognito OAuth2 URL builders
  - JWT verification singleton via aws-jwt-verify
  - Encrypted cookie session management via iron-session
  - getCurrentUser() helper for server components/actions
  - Cognito client secret loading in entrypoint.js
  - SESSION_SECRET generation in entrypoint.js
affects: [27-02 (callback route), 27-03 (proxy/middleware), 28-data-isolation]

# Tech tracking
tech-stack:
  added: [aws-jwt-verify@5.1.1, iron-session@8.0.4]
  patterns: [server-only imports for auth modules, singleton JWT verifier, encrypted HTTP-only cookies]

key-files:
  created: [lib/auth/types.ts, lib/auth/cognito.ts, lib/auth/verify.ts, lib/auth/session.ts, lib/auth/index.ts, lib/auth/__tests__/cognito.test.ts, lib/auth/__tests__/session.test.ts]
  modified: [entrypoint.js, package.json, vitest.config.mts]

key-decisions:
  - "Store only extracted claims + refresh token in session cookie (not full ID token) to avoid 4KB cookie size limit"
  - "Ephemeral SESSION_SECRET generated in entrypoint.js if not provided (rotates on container restart)"
  - "Cognito secret fetch is non-fatal -- app can start without auth features"

patterns-established:
  - "server-only import guard: all lib/auth/ modules import 'server-only' to prevent client-side usage"
  - "getCurrentUser() as defense-in-depth pattern (per CVE-2025-29927) -- verify auth in data access layer, not just proxy"
  - "Cognito URL builders use env vars from ECS container, no hardcoded values"

requirements-completed: [AUTH-01, AUTH-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 27 Plan 01: Auth Library Foundation Summary

**Cognito OAuth2 URL builders, JWT verification via aws-jwt-verify, and iron-session encrypted cookie management with 21 passing unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T14:59:47Z
- **Completed:** 2026-03-10T15:04:06Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete lib/auth/ module with typed interfaces (SessionData, UserInfo) and all Cognito OAuth2 functions
- TDD-driven Cognito URL builders: buildAuthorizeUrl (with identity_provider=Okta bypass), buildLogoutUrl, exchangeCodeForTokens, refreshTokens
- JWT verification singleton using aws-jwt-verify with automatic JWKS caching
- Encrypted cookie session via iron-session (rf-session, HTTP-only, 7-day max age)
- getCurrentUser() helper for defense-in-depth auth in server components/actions
- entrypoint.js loads Cognito client secret from Secrets Manager and generates SESSION_SECRET

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth types, Cognito URL builders, and unit tests (TDD RED)** - `0365f95` (test)
2. **Task 1: Auth types, Cognito URL builders, and unit tests (TDD GREEN)** - `306c59b` (feat)
3. **Task 2: JWT verification, session helpers, public API, and entrypoint secrets** - `9e49fe5` (feat)

_Note: Task 1 used TDD with separate RED and GREEN commits._

## Files Created/Modified
- `lib/auth/types.ts` - SessionData and UserInfo type definitions
- `lib/auth/cognito.ts` - Cognito OAuth2 URL builders and token exchange functions
- `lib/auth/verify.ts` - CognitoJwtVerifier singleton with aws-jwt-verify
- `lib/auth/session.ts` - iron-session config and getSession() helper
- `lib/auth/index.ts` - Public API: getCurrentUser(), getSession(), UserInfo re-exports
- `lib/auth/__tests__/cognito.test.ts` - 16 unit tests for URL builders and token exchange
- `lib/auth/__tests__/session.test.ts` - 5 unit tests for session config
- `entrypoint.js` - Added Cognito secret fetch and SESSION_SECRET generation
- `package.json` - Added aws-jwt-verify and iron-session dependencies
- `vitest.config.mts` - Renamed from .ts to .mts for Node 21 ESM compatibility

## Decisions Made
- Store only extracted claims + refresh token in session cookie (not full ID token) to stay within 4KB cookie limit
- Ephemeral SESSION_SECRET generated via crypto.randomBytes if not provided -- sessions invalidate on container restart (acceptable for initial deployment; can add Secrets Manager persistence later)
- Cognito secret fetch wrapped in try/catch as non-fatal -- app can start without auth features for backward compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed vitest.config.ts to vitest.config.mts**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** vitest 4.x with Node 21 fails to load .ts config due to ERR_REQUIRE_ESM
- **Fix:** Renamed to .mts extension, updated to use import.meta.url instead of __dirname
- **Files modified:** vitest.config.mts (renamed from vitest.config.ts)
- **Verification:** All tests run successfully
- **Committed in:** 0365f95 (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Config fix necessary to run any tests. No scope creep.

## Issues Encountered
None beyond the vitest config issue documented above.

## User Setup Required
None - no external service configuration required. Dependencies installed, entrypoint wired.

## Next Phase Readiness
- lib/auth/ module ready for import by callback route (Plan 02), proxy/middleware (Plan 03), and landing page
- All exports verified: buildAuthorizeUrl, buildLogoutUrl, exchangeCodeForTokens, refreshTokens, verifyIdToken, getSession, getCurrentUser, SessionData, UserInfo
- entrypoint.js ready to load Cognito secrets in ECS environment

---
*Phase: 27-auth-flow*
*Completed: 2026-03-10*
