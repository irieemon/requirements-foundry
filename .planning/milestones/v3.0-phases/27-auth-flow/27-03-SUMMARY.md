---
phase: 27-auth-flow
plan: 03
subsystem: auth
tags: [nextjs, layout, landing-page, cognito, okta, route-groups]

# Dependency graph
requires:
  - phase: 27-auth-flow
    provides: "lib/auth/cognito.ts buildAuthorizeUrl for sign-in button"
provides:
  - "Public landing page at / with Sign in with Okta button"
  - "Route group (authenticated) with AppShell layout"
  - "Root layout stripped of AppShell (bare html/body shell)"
affects: [27-auth-flow, 28-user-data, 29-admin]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Next.js route groups for layout splitting", "Lazy CognitoJwtVerifier initialization"]

key-files:
  created:
    - app/page.tsx
    - app/(authenticated)/layout.tsx
  modified:
    - app/layout.tsx
    - lib/auth/verify.ts

key-decisions:
  - "Lazy-initialize CognitoJwtVerifier to avoid crash when env vars absent in dev"
  - "Landing page is server component with buildAuthorizeUrl for sign-in href"
  - "Route group (authenticated) wraps children in AppShell; root layout is bare shell"

patterns-established:
  - "Route group pattern: (authenticated) for pages requiring AppShell"
  - "Lazy singleton pattern for services requiring env vars"

requirements-completed: [AUTH-02, AUTH-05]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 27 Plan 03: Landing Page & Layout Split Summary

**Public landing page with Okta sign-in button and Next.js route group splitting AppShell to authenticated routes only**

## Performance

- **Duration:** 3 min (across two sessions with human verification checkpoint)
- **Started:** 2026-03-10T15:10:00Z
- **Completed:** 2026-03-10T16:32:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created clean landing page at / with app name, tagline, and "Sign in with Okta" button linking to Cognito authorize URL
- Split root layout to remove AppShell; created (authenticated) route group layout with AppShell wrapper
- Moved existing pages (projects, runs) into (authenticated) route group -- URLs unchanged
- Fixed CognitoJwtVerifier eager initialization crash in dev environment

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure layouts and create landing page** - `17bad81` (feat)
2. **Task 2: Move existing pages into (authenticated) route group** - no commit (files already moved by Plan 02; empty dirs cleaned)
3. **Task 3: Verify landing page and layout split** - human-verified, approved

**Bugfix:** `8a17b4f` (fix) - Lazy-initialize CognitoJwtVerifier

## Files Created/Modified
- `app/page.tsx` - Public landing page with sign-in button and error/returnTo query param handling
- `app/layout.tsx` - Root layout stripped of AppShell (bare html/body/fonts/toaster)
- `app/(authenticated)/layout.tsx` - Route group layout wrapping children in AppShell
- `lib/auth/verify.ts` - Lazy-initialized CognitoJwtVerifier singleton

## Decisions Made
- Lazy-initialize CognitoJwtVerifier to avoid crash when COGNITO_USER_POOL_ID/CLIENT_ID env vars are absent (dev environment)
- Landing page is a server component that calls buildAuthorizeUrl() at render time
- Route group (authenticated) provides AppShell; root layout is bare shell with only html/body/fonts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy-initialize CognitoJwtVerifier to prevent dev crash**
- **Found during:** Task 3 (verification)
- **Issue:** CognitoJwtVerifier.create() was called at module load time, crashing when env vars absent in dev
- **Fix:** Changed to lazy singleton pattern -- verifier created on first use via getVerifier()
- **Files modified:** lib/auth/verify.ts
- **Verification:** Dev server starts without crash; build succeeds
- **Committed in:** `8a17b4f`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for dev environment stability. No scope creep.

## Issues Encountered
- Task 2 was a no-op because Plan 02 had already moved files into the (authenticated) route group. Empty directories were cleaned up but no commit was needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth flow complete: landing page, route protection, callback/logout routes all in place
- Ready for Phase 28 (User Data) or Phase 29 (Admin)
- Okta SAML integration still requires IT team action (external dependency from Phase 26)

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 27-auth-flow*
*Completed: 2026-03-10*
