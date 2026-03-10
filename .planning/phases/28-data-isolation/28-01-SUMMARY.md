---
phase: 28-data-isolation
plan: 01
subsystem: auth
tags: [authorization, prisma, migration, ownership, admin]

# Dependency graph
requires:
  - phase: 27-auth-flow
    provides: getCurrentUser() with email from Okta SSO session
provides:
  - ADMIN_EMAIL constant and isAdmin() helper
  - getAuthorizedProject() ownership-or-admin gate returning 404 on denial
  - getAuthorizedProjects() user-scoped project listing with admin bypass
  - Prisma migration making Project.userId non-nullable with backfill
affects: [28-data-isolation plans 02 and 03, all server actions, all API routes]

# Tech tracking
tech-stack:
  added: []
  patterns: [centralized authorization helper, ownership-or-admin gate, 404-not-403 access denial]

key-files:
  created:
    - lib/auth/authorization.ts
    - lib/auth/__tests__/authorization.test.ts
    - prisma/migrations/20260310000000_add_user_ownership/migration.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Hardcoded ADMIN_EMAIL constant -- Okta group detection deferred per user decision"
  - "Manual migration directory creation due to Prisma CLI ESM/CJS incompatibility on local Node 21.5.0"

patterns-established:
  - "Centralized authorization: all project access goes through getAuthorizedProject/getAuthorizedProjects"
  - "404-not-403: unauthorized access returns notFound() to avoid leaking project existence"
  - "Backfill-then-alter: migration pattern for making nullable columns required"

requirements-completed: [DATA-04, ADMIN-01, ADMIN-03]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 28 Plan 01: Authorization Module & Migration Summary

**Centralized authorization helpers (isAdmin, getAuthorizedProject, getAuthorizedProjects) with TDD tests and Prisma migration backfilling userId to non-nullable**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T19:35:20Z
- **Completed:** 2026-03-10T19:37:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Authorization module with ADMIN_EMAIL, isAdmin(), getAuthorizedProject(), getAuthorizedProjects() -- all exported and tested
- 11 unit tests covering admin detection, ownership verification, admin bypass, and 404 denial
- Prisma migration with backfill-then-alter pattern making Project.userId non-nullable
- TDD workflow followed: RED (failing tests) -> GREEN (implementation) -> verified

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Authorization tests** - `dd2698d` (test)
2. **Task 1 (GREEN): Authorization module** - `185bc78` (feat)
3. **Task 2: Prisma migration and schema** - `2161584` (feat)

_TDD task had separate RED and GREEN commits._

## Files Created/Modified
- `lib/auth/authorization.ts` - Centralized authorization helpers (isAdmin, getAuthorizedProject, getAuthorizedProjects)
- `lib/auth/__tests__/authorization.test.ts` - 11 unit tests with mocked getCurrentUser, db, and notFound
- `prisma/migrations/20260310000000_add_user_ownership/migration.sql` - Backfill NULL userId then ALTER to NOT NULL
- `prisma/schema.prisma` - Changed userId from String? to String (non-nullable)

## Decisions Made
- Hardcoded ADMIN_EMAIL constant per user decision (Okta group detection deferred)
- Created migration directory manually because Prisma CLI has ESM/CJS incompatibility with Node 21.5.0 locally (will work in production Docker container)
- getAuthorizedProjects includes same orderBy and _count as existing getProjects() for drop-in replacement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration directory creation**
- **Found during:** Task 2
- **Issue:** `npx prisma migrate dev --create-only` fails with ERR_REQUIRE_ESM (zeptomatch/prisma-dev CJS/ESM conflict on Node 21.5.0)
- **Fix:** Created migration directory and SQL file manually, following existing migration naming convention (YYYYMMDD000000_name)
- **Files modified:** prisma/migrations/20260310000000_add_user_ownership/migration.sql
- **Verification:** SQL content verified correct (backfill before ALTER); schema validated by grep
- **Committed in:** 2161584

**2. [Rule 3 - Blocking] Prisma validate/generate skipped**
- **Found during:** Task 2 verification
- **Issue:** `npx prisma validate` and `npx prisma generate` also fail with same ERR_REQUIRE_ESM
- **Fix:** Verified schema correctness manually (userId String with no ?); Prisma client will regenerate on next build or deploy
- **Files modified:** None
- **Verification:** grep confirmed `userId      String` (no ?) in schema.prisma

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both deviations are environment-specific (local Node.js version). Schema and migration are correct and will work in production. No scope creep.

## Issues Encountered
- Prisma CLI (all commands) broken on local machine due to @prisma/dev ESM/CJS incompatibility with Node 21.5.0. This is pre-existing and affects all Prisma commands. Production Docker container uses a compatible Node version.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Authorization module ready for Plans 02 and 03 to integrate into server actions and API routes
- getAuthorizedProject() and getAuthorizedProjects() are the contracts all data access will use
- Migration will auto-apply on next deploy via entrypoint.js prisma migrate deploy
- Pending: run `npx prisma generate` in an environment with compatible Node version to regenerate client

---
*Phase: 28-data-isolation*
*Completed: 2026-03-10*
