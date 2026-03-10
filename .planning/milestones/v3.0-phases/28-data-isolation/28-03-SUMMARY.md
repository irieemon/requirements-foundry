---
phase: 28-data-isolation
plan: 03
subsystem: auth
tags: [authorization, ownership, api-routes, data-isolation, admin]

# Dependency graph
requires:
  - phase: 28-data-isolation
    provides: isAdmin(), getCurrentUser(), getAuthorizedProject(), getAuthorizedProjects() from Plan 01
provides:
  - Ownership-gated API routes for projects, uploads, and runs
  - User-scoped page components for projects list, runs list, and run detail
  - Admin owner badges on projects page
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [API route ownership gate with 404 JSON response, run->project->userId join for run ownership, user-scoped DB queries in page components]

key-files:
  created: []
  modified:
    - app/api/projects/[id]/active-run/route.ts
    - app/api/projects/[id]/active-batch-story-run/route.ts
    - app/api/projects/[id]/active-subtask-run/route.ts
    - app/api/uploads/route.ts
    - app/api/runs/[id]/route.ts
    - app/api/runs/[id]/batch-story/route.ts
    - app/api/runs/[id]/subtask-progress/route.ts
    - app/(authenticated)/projects/page.tsx
    - app/(authenticated)/runs/page.tsx
    - app/(authenticated)/runs/[id]/page.tsx
    - components/projects/project-list.tsx
    - components/projects/project-card.tsx

key-decisions:
  - "API routes use getCurrentUser + isAdmin directly instead of getAuthorizedProject to avoid notFound() throw in route handlers"
  - "Projects page calls getAuthorizedProjects directly to access isAdmin and user info for owner badges"
  - "Run ownership verified via run->project->userId join pattern"

patterns-established:
  - "API route ownership gate: fetch project by ID, check userId or isAdmin, return 404 JSON"
  - "Run route ownership: include project.userId in run query, check ownership before proceeding"
  - "Admin owner badge: annotate projects with ownerLabel when admin views others' projects"

requirements-completed: [DATA-02, DATA-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 28 Plan 03: API Routes & Page Components Summary

**Ownership enforcement on all 7 API routes and 3 page components with admin bypass and owner badges, completing the data isolation layer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T19:40:33Z
- **Completed:** 2026-03-10T19:44:51Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- All 7 API routes gated with ownership checks returning 404 JSON for unauthorized access
- Upload route checks projectId ownership on both GET and POST handlers
- Run API routes verify ownership via run->project->userId join
- Projects page shows admin owner badges for other users' projects
- Runs list page filtered to user's projects (admin sees all)
- Run detail page verifies ownership before rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ownership checks to all API routes** - `59c6c95` (feat)
2. **Task 2: Update page components for user-scoped data** - `cc5afd3` (feat)

## Files Created/Modified
- `app/api/projects/[id]/active-run/route.ts` - Ownership gate on active run polling
- `app/api/projects/[id]/active-batch-story-run/route.ts` - Ownership gate on batch story polling
- `app/api/projects/[id]/active-subtask-run/route.ts` - Ownership gate on subtask polling
- `app/api/uploads/route.ts` - Ownership gate on upload GET and POST
- `app/api/runs/[id]/route.ts` - Run->project ownership gate on run progress
- `app/api/runs/[id]/batch-story/route.ts` - Run->project ownership gate on batch story progress
- `app/api/runs/[id]/subtask-progress/route.ts` - Run->project ownership gate on subtask progress
- `app/(authenticated)/projects/page.tsx` - Uses getAuthorizedProjects with admin owner badges
- `app/(authenticated)/runs/page.tsx` - User-scoped runs query with admin bypass
- `app/(authenticated)/runs/[id]/page.tsx` - Ownership check before rendering run detail
- `components/projects/project-list.tsx` - Added ownerLabel to interface
- `components/projects/project-card.tsx` - Displays owner email for admin viewing others' projects

## Decisions Made
- API routes use getCurrentUser + isAdmin directly (not getAuthorizedProject) because getAuthorizedProject calls notFound() which throws in route handlers -- API routes must return NextResponse.json with 404 status instead
- Projects page calls getAuthorizedProjects() directly rather than getProjects() server action to access isAdmin flag and user info for owner badges
- Run ownership uses include: { project: { select: { userId: true } } } join pattern for efficient single-query verification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data isolation layer is complete across all server actions (Plan 02), API routes, and page components
- Phase 28 fully done -- all project data access is ownership-gated
- Ready for Phase 29 (final milestone phase)

---
*Phase: 28-data-isolation*
*Completed: 2026-03-10*
