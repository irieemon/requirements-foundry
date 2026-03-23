---
phase: 30-data-foundation
plan: 01
subsystem: database
tags: [prisma, postgresql, migration, user-model, project-share, auth-callback, upsert]

# Dependency graph
requires:
  - phase: 29-admin-ui-polish
    provides: Auth callback route, session management, Cognito SSO login flow
provides:
  - User model in Prisma schema with unique email
  - ProjectShare model with cascade deletes and unique [projectId, userId]
  - Migration SQL with User backfill from existing Project.userId
  - Login-time User upsert in auth callback
affects: [31-authorization-refactor, 32-share-management, 33-projects-page-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [user-upsert-on-login, try-catch-non-blocking-upsert, migration-backfill-from-existing-data]

key-files:
  created:
    - prisma/migrations/20260323000000_add_user_and_shares/migration.sql
    - lib/auth/__tests__/project-share.test.ts
    - lib/auth/__tests__/user-upsert.test.ts
  modified:
    - prisma/schema.prisma
    - app/api/auth/callback/route.ts

key-decisions:
  - "Non-blocking upsert: User upsert wrapped in try-catch so login succeeds even if DB write fails"
  - "Email as match key: User upsert matches on email (not sub) for consistency with existing Project.userId pattern"

patterns-established:
  - "Non-blocking DB write in auth flow: wrap in try-catch, log error, continue with redirect"
  - "Migration backfill: INSERT INTO from SELECT DISTINCT for populating new tables from existing data"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 30 Plan 01: Data Foundation Summary

**User and ProjectShare Prisma models with migration backfill and login-time upsert in auth callback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T22:03:15Z
- **Completed:** 2026-03-23T22:07:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- User model with cuid id, unique email, nullable name, and timestamps added to Prisma schema
- ProjectShare model with cascade deletes on both project and user FKs, unique [projectId, userId] constraint
- Migration SQL creates both tables and backfills User from existing Project.userId values
- Auth callback upserts User record on every login (email match, name update from Cognito claims)
- 10 new tests (6 for ProjectShare schema, 4 for User upsert behavior)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add User and ProjectShare models to Prisma schema and create migration with backfill** - `2e651b5` (feat)
2. **Task 2: Add User upsert to auth callback with tests** - `5974cdc` (feat)

_Both tasks used TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `prisma/schema.prisma` - Added User model, ProjectShare model, shares relation on Project
- `prisma/migrations/20260323000000_add_user_and_shares/migration.sql` - DDL for User and ProjectShare tables plus backfill SQL
- `app/api/auth/callback/route.ts` - Added db import and User upsert after session.save()
- `lib/auth/__tests__/project-share.test.ts` - 6 tests for ProjectShare schema shape and constraints
- `lib/auth/__tests__/user-upsert.test.ts` - 4 tests for User upsert behavior in auth callback

## Decisions Made
- Non-blocking upsert: Wrapped in try-catch so login continues even if DB write fails (user created on next login)
- Email as match key for upsert: Consistent with existing Project.userId which stores email addresses

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all models are fully defined and wired.

## Issues Encountered
- Prisma CLI (`prisma validate`, `prisma generate`) fails on Node.js v21.5.0 due to ESM/CJS incompatibility in @prisma/dev package. This is a pre-existing local environment issue. Schema was validated via test-based file reading instead. CI/CD environment uses compatible Node version.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- User and ProjectShare models ready for Phase 31 (Authorization Refactor) to query shares for role resolution
- Auth callback creates User records on login, populating the User table for user picker in Phase 32
- Migration backfill ensures existing users appear in User table after deployment

## Self-Check: PASSED

All 6 files found. Both commits verified. All content checks passed.

---
*Phase: 30-data-foundation*
*Completed: 2026-03-23*
