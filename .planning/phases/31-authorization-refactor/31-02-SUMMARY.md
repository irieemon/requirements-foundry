---
phase: 31-authorization-refactor
plan: 02
subsystem: auth
tags: [authorization, rbac, viewer, canEdit, server-actions]

# Dependency graph
requires:
  - phase: 31-authorization-refactor plan 01
    provides: "getAuthorizedProject returns AuthResult with canEdit boolean"
provides:
  - "All 11 server action files enforce viewer mutation guards via canEdit"
  - "Viewer role receives Read-only access rejection on mutations"
  - "Read-only functions remain accessible to all roles"
affects: [31-authorization-refactor plan 03, UI components calling server actions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["canEdit guard pattern for mutation server actions", "throw vs return based on existing error handling pattern"]

key-files:
  created: []
  modified:
    - server/actions/uploads.ts
    - server/actions/analysis.ts
    - server/actions/generation.ts
    - server/actions/batch-stories.ts
    - server/actions/subtasks.ts
    - server/actions/projects.ts
    - server/actions/jira-export.ts
    - server/actions/export.ts
    - server/actions/mss.ts
    - server/actions/questions.ts

key-decisions:
  - "Functions returning {success, error} objects use return pattern; functions that throw use throw pattern for Read-only access guard"
  - "epics.ts has no mutation functions -- all read-only, no guards needed (10 files modified, not 11)"
  - "deleteUpload returns void, so viewer guard returns bare return (no error object)"

patterns-established:
  - "Viewer guard pattern A (try-catch): let auth; try { auth = await getAuthorizedProject(id); } catch { return error; } if (!auth.canEdit) { return read-only; }"
  - "Viewer guard pattern B (bare await): const { canEdit } = await getAuthorizedProject(id); if (!canEdit) { return/throw read-only; }"

requirements-completed: [AUTH-02]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 31 Plan 02: Viewer Mutation Guards Summary

**canEdit guard added to 29 mutation functions across 10 server action files, blocking viewer role with Read-only access rejection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T00:35:06Z
- **Completed:** 2026-03-24T00:39:28Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added viewer mutation guards to all 6 Task-1 server action files (uploads, analysis, generation, batch-stories, subtasks, projects)
- Added viewer mutation guards to all Task-2 server action files (jira-export, export, mss, questions)
- Confirmed epics.ts has no mutation functions (all read-only) -- no changes needed
- createProject correctly left unguarded (user-level action, not project-level)
- All 170 passing tests remain green (9 pre-existing failures in unrelated infra/cognito tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add viewer guards to uploads, analysis, generation, batch-stories, subtasks, projects** - `43e4861` (feat)
2. **Task 2: Add viewer guards to jira-export, export, mss, questions, epics** - `4d1b458` (feat)

## Files Created/Modified
- `server/actions/uploads.ts` - Guards on createUploadFromText, createUploadFromCSV, deleteUpload
- `server/actions/analysis.ts` - Guards on analyzeProject, cancelRun, retryFailedUploads
- `server/actions/generation.ts` - Guards on generateEpicsForProject, generateStoriesForEpic
- `server/actions/batch-stories.ts` - Guards on startGenerateAllStories, cancelBatchStoryRun, retryFailedEpics
- `server/actions/subtasks.ts` - Guards on startGenerateSubtasks, cancelBatchSubtaskRun, retryFailedStories
- `server/actions/projects.ts` - Guards on updateProject, deleteProject
- `server/actions/jira-export.ts` - Guards on all 7 export functions (getExportStats, previewExport, generateExport, getAvailableRuns, getEpicsForSelection, getProjectForExport, getFullPreviewItems)
- `server/actions/export.ts` - Guards on exportProjectAsCSV, exportProjectAsJSON, exportEpicAsCSV
- `server/actions/mss.ts` - Guards on updateEpicMss, updateStoryMss
- `server/actions/questions.ts` - Guards on generateQuestionsForUpload, submitQuestionAnswers

## Decisions Made
- Functions that return `{ success, error }` objects use `return { success: false, error: "Read-only access" }` pattern
- Functions that throw errors (jira-export, export) use `throw new Error("Read-only access")` to match their existing error handling
- `deleteUpload` returns void, so its guard uses bare `return;` (no error object)
- epics.ts confirmed as all read-only (getEpic, getEpicsForProject, getEpicWithStories) -- no guards needed

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated epics.ts might have no mutations ("Check if there are any mutation functions") and indeed it has none.

## Issues Encountered
None

## Known Stubs
None -- all guards are fully wired with real canEdit checks from the authorization module.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All mutation server actions now enforce viewer role restrictions
- Ready for Plan 03 (API route handler consolidation) or UI-level disable of mutation controls for viewers
- Test suite remains stable with no regressions

---
*Phase: 31-authorization-refactor*
*Completed: 2026-03-24*
