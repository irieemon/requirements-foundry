---
phase: 31-authorization-refactor
plan: 01
subsystem: auth
tags: [prisma, rbac, role-resolution, project-sharing, authorization]

# Dependency graph
requires:
  - phase: 30-data-foundation
    provides: User table with email unique index, ProjectShare table with role field and indexes
provides:
  - ProjectRole type and AuthResult/AuthResultWithEntity interfaces
  - resolveRole pure function (admin > owner > editor > viewer > null priority)
  - Refactored getAuthorizedProject with ProjectShare lookup and role resolution
  - Refactored getAuthorizedProjects returning owned + shared projects with per-project roles
  - getAuthorizedRun helper for run-level authorization
affects: [31-02-PLAN, 31-03-PLAN, 33-projects-page-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [role-based-authorization, email-to-userid-bridge, conditional-prisma-include, share-stripping]

key-files:
  created: []
  modified:
    - lib/auth/authorization.ts
    - lib/auth/__tests__/authorization.test.ts

key-decisions:
  - "Two-query approach for User lookup + Project with shares (pragmatic over single raw query)"
  - "Strip shares from returned project to prevent data leakage to clients"
  - "Conditional shares include: only when dbUser exists (handles no User record edge case)"
  - "Two parallel queries for getAuthorizedProjects (owned + shared) for natural role annotation"

patterns-established:
  - "resolveRole pure function: centralized role priority resolution (admin > owner > editor > viewer > null)"
  - "AuthResult return shape: { project, user, role, canEdit, isAdmin } from all auth functions"
  - "AuthResultWithEntity<T>: entity-specific auth helpers extend base AuthResult"
  - "Email-to-User.id bridge: db.user.findUnique({ where: { email } }) before share lookup"

requirements-completed: [AUTH-01, AUTH-03]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 31 Plan 01: Authorization Module Refactor Summary

**Role-based authorization with ProjectShare lookup, resolveRole priority function, and enriched AuthResult return shape across getAuthorizedProject, getAuthorizedProjects, and getAuthorizedRun**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T00:31:03Z
- **Completed:** 2026-03-24T00:33:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added ProjectRole type, AuthResult and AuthResultWithEntity interfaces for type-safe role-based authorization
- Implemented resolveRole pure function with admin > owner > editor > viewer > null priority
- Refactored getAuthorizedProject to look up User by email, conditionally include ProjectShare records, resolve roles, and return enriched result
- Refactored getAuthorizedProjects to return owned projects plus shared projects with per-project roles via parallel queries
- Added getAuthorizedRun helper that resolves parent project authorization and returns run entity
- 30 tests covering all role combinations, share-based access, admin bypass, no-User-record edge case, and share data stripping

## Task Commits

Both tasks were implemented together (same files) and committed atomically:

1. **Task 1: Add types, resolveRole, and refactor getAuthorizedProject** - `a7918f4` (feat)
2. **Task 2: Refactor getAuthorizedProjects and add getAuthorizedRun** - `a7918f4` (feat, same commit -- same files)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `lib/auth/authorization.ts` - Refactored authorization module with ProjectRole type, AuthResult interfaces, resolveRole function, refactored getAuthorizedProject/getAuthorizedProjects, new getAuthorizedRun helper
- `lib/auth/__tests__/authorization.test.ts` - Comprehensive test suite (30 tests) covering resolveRole priority, getAuthorizedProject with shares, getAuthorizedProjects with owned+shared, getAuthorizedRun, admin bypass, no-User-record edge cases

## Decisions Made
- Used two-query approach (User lookup + Project with shares) rather than single raw SQL query -- both are indexed unique lookups, sub-ms each
- Strip shares from returned project object to prevent share data leaking to client code
- Conditional Prisma include: only include shares when dbUser exists (gracefully handles users without a User record)
- getAuthorizedProjects uses two parallel queries (owned + shared) merged, which naturally separates owned vs shared for downstream role annotation

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Authorization module is fully refactored with role-based access control
- Plan 31-02 can add viewer mutation guards using the canEdit flag from AuthResult
- Plan 31-03 can consolidate inline API route checks using getAuthorizedRun and getAuthorizedProject
- Downstream Phase 33 can consume role info for UI badge display on project cards

---
*Phase: 31-authorization-refactor*
*Completed: 2026-03-24*
