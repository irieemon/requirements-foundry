---
phase: 31-authorization-refactor
plan: 03
subsystem: auth
tags: [authorization, centralization, api-routes, server-components, role-based-access]

# Dependency graph
requires:
  - phase: 31-authorization-refactor/01
    provides: getAuthorizedProject and getAuthorizedRun centralized helpers
provides:
  - All API routes and page routes use centralized auth helpers
  - Zero inline project.userId ownership checks outside lib/auth/
  - Upload POST has viewer guard (canEdit check) for mutation protection
affects: [31-authorization-refactor/02, shared-projects, api-polling]

# Tech tracking
tech-stack:
  added: []
  patterns: [try-catch-notFound-to-json-404, viewer-guard-on-mutations]

key-files:
  created: []
  modified:
    - app/api/runs/[id]/route.ts
    - app/api/runs/[id]/batch-story/route.ts
    - app/api/runs/[id]/subtask-progress/route.ts
    - app/api/projects/[id]/active-run/route.ts
    - app/api/projects/[id]/active-batch-story-run/route.ts
    - app/api/projects/[id]/active-subtask-run/route.ts
    - app/api/uploads/route.ts
    - app/(authenticated)/runs/[id]/page.tsx

key-decisions:
  - "try-catch pattern wraps getAuthorizedRun/getAuthorizedProject in API routes to convert notFound() throws to JSON 404 responses"
  - "Upload POST gets canEdit viewer guard (mutation), Upload GET does not (read-only)"
  - "Run detail page calls getAuthorizedProject redundantly (getRun already does auth internally) but this is safe and explicit"

patterns-established:
  - "API route auth pattern: try { await getAuthorizedX(id); } catch { return JSON 404; }"
  - "Page route auth pattern: await getAuthorizedProject(id) -- notFound() propagates naturally"
  - "Mutation endpoints check auth.canEdit for viewer guard"

requirements-completed: [AUTH-01]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 31 Plan 03: Consolidate Inline Auth Summary

**Replaced all inline project.userId ownership checks across 7 API routes and 1 page route with centralized getAuthorizedRun/getAuthorizedProject helpers, adding viewer guard on upload mutations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T00:35:07Z
- **Completed:** 2026-03-24T00:38:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Eliminated all inline `project.userId !== user.email` auth checks from API routes and page routes
- 3 run-related API routes migrated to getAuthorizedRun with try-catch JSON 404 pattern
- 3 project-related API routes + upload route migrated to getAuthorizedProject
- Upload POST now has canEdit viewer guard (403 for viewers), Upload GET remains unrestricted
- Run detail page migrated to getAuthorizedProject (notFound propagates naturally in Server Components)
- D-10 consolidation complete: zero inline ownership checks remain outside lib/auth/

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate run-related API routes to getAuthorizedRun** - `0fbda33` (feat)
2. **Task 2: Migrate project API routes, uploads, and run page to centralized auth** - `56ebfd5` (feat)

## Files Created/Modified
- `app/api/runs/[id]/route.ts` - Run progress polling, now uses getAuthorizedRun
- `app/api/runs/[id]/batch-story/route.ts` - Batch story progress polling, now uses getAuthorizedRun
- `app/api/runs/[id]/subtask-progress/route.ts` - Subtask progress polling, now uses getAuthorizedRun
- `app/api/projects/[id]/active-run/route.ts` - Active run check, now uses getAuthorizedProject
- `app/api/projects/[id]/active-batch-story-run/route.ts` - Active batch story run check, now uses getAuthorizedProject
- `app/api/projects/[id]/active-subtask-run/route.ts` - Active subtask run check, now uses getAuthorizedProject
- `app/api/uploads/route.ts` - Upload POST/GET, now uses getAuthorizedProject with canEdit guard on POST
- `app/(authenticated)/runs/[id]/page.tsx` - Run detail page, now uses getAuthorizedProject

## Decisions Made
- Used try-catch pattern in API routes to convert notFound() throws to JSON 404 responses (preserves client expectations for polling endpoints)
- Added canEdit viewer guard only on Upload POST (mutation) -- Upload GET is read-only and does not need a viewer guard
- Kept redundant getAuthorizedProject call in run detail page even though getRun already does auth internally -- explicit is better, and the double-check is idempotent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all auth wiring is complete with no placeholder logic.

## Next Phase Readiness
- All inline ownership checks consolidated into lib/auth/authorization.ts
- Shared users (editors/viewers) can now access all polling endpoints and pages for projects shared with them
- D-10 requirement fully satisfied
- Ready for Plan 02 (server action consolidation) to complete the authorization refactor

## Self-Check: PASSED

All 8 modified files exist. Both task commits (0fbda33, 56ebfd5) verified. SUMMARY.md created.

---
*Phase: 31-authorization-refactor*
*Completed: 2026-03-24*
