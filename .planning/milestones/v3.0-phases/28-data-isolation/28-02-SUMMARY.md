---
phase: 28-data-isolation
plan: 02
subsystem: auth
tags: [authorization, ownership, server-actions, data-isolation, multi-tenant]

# Dependency graph
requires:
  - phase: 28-data-isolation plan 01
    provides: getAuthorizedProject() and getAuthorizedProjects() authorization helpers
provides:
  - All 11 server action files enforce ownership checks on project-scoped operations
  - createProject assigns userId from authenticated session
  - getProjects returns user-scoped results (admin sees all)
affects: [28-data-isolation plan 03, API routes, page components]

# Tech tracking
tech-stack:
  added: []
  patterns: [ownership-first server actions, try-catch authorization for structured responses, entity-chain ownership lookup]

key-files:
  created: []
  modified:
    - server/actions/projects.ts
    - server/actions/analysis.ts
    - server/actions/generation.ts
    - server/actions/batch-stories.ts
    - server/actions/uploads.ts
    - server/actions/epics.ts
    - server/actions/subtasks.ts
    - server/actions/export.ts
    - server/actions/jira-export.ts
    - server/actions/mss.ts
    - server/actions/questions.ts

key-decisions:
  - "MSS taxonomy CRUD operations kept global (no ownership check) since MSS is shared across all users"
  - "Run/upload/epic ownership verified by looking up parent project chain rather than adding userId to every entity"
  - "Functions returning {success, error} use try/catch around getAuthorizedProject; functions with no structured error call getAuthorizedProject directly (lets notFound() propagate)"

patterns-established:
  - "Ownership-first: every server action that accesses project-scoped data calls getAuthorizedProject before any DB mutation"
  - "Entity chain lookup: for functions taking epicId/uploadId/runId, look up the parent projectId then verify ownership"
  - "Error shape preservation: try/catch wrapping for functions returning {success, error} to avoid uncaught notFound()"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 7min
completed: 2026-03-10
---

# Phase 28 Plan 02: Server Action Ownership Enforcement Summary

**Ownership checks in all 11 server action files using getAuthorizedProject, with createProject auto-assigning userId from session**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T19:40:29Z
- **Completed:** 2026-03-10T19:47:48Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- All 11 server action files now import and use getAuthorizedProject/getAuthorizedProjects for ownership enforcement
- createProject assigns userId from getCurrentUser().email (satisfies DATA-01)
- getProjects returns user-scoped results via getAuthorizedProjects (satisfies DATA-02)
- No unprotected direct project queries remain in server/actions/ (satisfies DATA-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce ownership in projects.ts, analysis.ts, generation.ts, batch-stories.ts, uploads.ts, epics.ts** - `3136624` (feat)
2. **Task 2: Enforce ownership in subtasks.ts, export.ts, jira-export.ts, mss.ts, questions.ts** - `1ad6fb8` (feat)

## Files Created/Modified
- `server/actions/projects.ts` - Uses getAuthorizedProjects for listing, getAuthorizedProject for get/update/delete, getCurrentUser for createProject userId
- `server/actions/analysis.ts` - All 6 functions verify project ownership (analyzeProject, getRunProgress, cancelRun, retryFailedUploads, getActiveRunForProject, getPendingUploadCount)
- `server/actions/generation.ts` - Epic/story generation, getRun, getRunsForProject all check ownership
- `server/actions/batch-stories.ts` - All 6 batch story functions verify ownership
- `server/actions/uploads.ts` - Upload creation, retrieval, and deletion verify project ownership
- `server/actions/epics.ts` - Epic queries verify ownership via epic->project chain
- `server/actions/subtasks.ts` - All 6 subtask functions verify ownership via epic/run->project chain
- `server/actions/export.ts` - CSV and JSON exports verify project ownership
- `server/actions/jira-export.ts` - All 7 Jira export functions verify project ownership
- `server/actions/mss.ts` - updateEpicMss and updateStoryMss verify ownership; taxonomy CRUD remains global
- `server/actions/questions.ts` - Question generation, answer submission, and retrieval verify upload->project ownership

## Decisions Made
- MSS taxonomy CRUD operations (import, stats, hierarchy, service line/area/activity CRUD) kept without ownership checks since MSS is a shared global taxonomy, not project-scoped data
- For functions that take a runId, uploadId, epicId, or storyId: look up the parent entity chain to find projectId, then call getAuthorizedProject, rather than requiring callers to pass projectId
- Functions returning structured `{success, error}` objects wrap getAuthorizedProject in try/catch to return the error shape; functions that throw or return null let notFound() propagate naturally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All server actions now enforce ownership -- ready for Plan 03 (API Routes & Page Components)
- The authorization pattern is consistent across all 11 files
- Pre-existing test failures in infra/ (Jest/Vitest incompatibility) remain unchanged -- not related to this plan

## Self-Check: PASSED

All 11 modified server action files exist. Both task commits verified (3136624, 1ad6fb8).

---
*Phase: 28-data-isolation*
*Completed: 2026-03-10*
