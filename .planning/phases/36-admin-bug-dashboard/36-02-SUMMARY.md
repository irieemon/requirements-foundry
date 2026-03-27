---
phase: 36-admin-bug-dashboard
plan: 02
subsystem: ui
tags: [admin, bug-reports, data-table, sidebar, expandable-rows, status-workflow]

# Dependency graph
requires:
  - phase: 36-admin-bug-dashboard
    plan: 01
    provides: getBugReports, updateBugReport, getOpenBugReportCount server actions
provides:
  - /bug-reports admin page with data table
  - BugReportTable client component with filtering, sorting, expandable rows
  - BugReportExpandedRow with status workflow and admin notes
  - BugReportStatusBadge with 4 color-coded statuses
  - Sidebar and mobile nav Bug Reports link with open count badge
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [expandable table rows with dirty state protection, admin-conditional nav items with badge]

key-files:
  created:
    - components/bug-reports/bug-report-status-badge.tsx
    - components/bug-reports/bug-report-expanded-row.tsx
    - components/bug-reports/bug-report-table.tsx
    - app/(authenticated)/bug-reports/page.tsx
  modified:
    - app/(authenticated)/layout.tsx
    - components/layout/app-shell.tsx
    - components/layout/sidebar.tsx
    - components/layout/mobile-nav.tsx

key-decisions:
  - "Client-side filtering and sorting (dataset small for internal corporate tool)"
  - "Dirty state protection via pendingEdits Map preserves unsaved edits across row expansion"
  - "Custom formatRelativeDate utility instead of date-fns dependency"

patterns-established:
  - "Admin-conditional nav item pattern: spread into navItems array when isAdmin is true"
  - "Prop threading for badge count: layout -> AppShell -> Sidebar/MobileNav"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05]

# Metrics
duration: 4min
completed: 2026-03-27
status: checkpoint-paused
---

# Phase 36 Plan 02: Admin Bug Dashboard UI Summary

**Admin bug dashboard with data table, expandable rows, status workflow, filtering, sorting, and sidebar badge -- awaiting human verification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T19:32:16Z
- **Paused at checkpoint:** 2026-03-27T19:36:39Z
- **Tasks completed:** 2/3 (Task 3 is human-verify checkpoint)
- **Files created:** 4
- **Files modified:** 4

## Accomplishments

- BugReportStatusBadge: 4 color-coded status variants (open/in-progress/resolved/closed) using Badge outline with custom classNames
- BugReportExpandedRow: 2-column grid layout with full description, browser info parsing, status Select dropdown, admin notes Textarea, Save button with loading spinner
- BugReportTable: Client data table with status filter Select, date sort toggle, expandable rows (one at a time), dirty state protection via pendingEdits Map, empty states for no data and no filter matches, accessibility (aria-expanded, keyboard navigation)
- Bug reports page: Server component with admin guard (redirect non-admin to /projects), getBugReports data fetch, PageHeader + BugReportTable
- Layout wiring: openBugReportCount passed from layout through AppShell to Sidebar and MobileNav
- Sidebar: Bug Reports nav item with open count Badge (admin-only), collapsed tooltip shows count
- Mobile nav: Bug Reports nav item with Badge (admin-only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create status badge, expanded row, and table components** - `a2ca69a` (feat)
2. **Task 2: Create bug reports page and wire sidebar badge** - `b2e72f7` (feat)
3. **Task 3: Verify admin bug dashboard end-to-end** - PENDING (checkpoint:human-verify)

## Files Created/Modified

- `components/bug-reports/bug-report-status-badge.tsx` - Shared status badge with STATUS_CONFIG for 4 statuses
- `components/bug-reports/bug-report-expanded-row.tsx` - Expanded row detail panel with status, notes, save
- `components/bug-reports/bug-report-table.tsx` - Main data table with filter, sort, expand, dirty state
- `app/(authenticated)/bug-reports/page.tsx` - Server component page with admin guard
- `app/(authenticated)/layout.tsx` - Added getOpenBugReportCount call for admin users
- `components/layout/app-shell.tsx` - Added openBugReportCount prop threading
- `components/layout/sidebar.tsx` - Added Bug Reports nav item with badge (admin-only)
- `components/layout/mobile-nav.tsx` - Added Bug Reports nav item with badge (admin-only)

## Decisions Made

- Client-side filtering and sorting: dataset is small for internal corporate tool, no server round-trips needed
- Dirty state protection via pendingEdits Map: preserves unsaved edits when user expands different row
- Custom relative date formatting instead of adding date-fns dependency

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components are fully functional with real server actions wired.

## Issues Encountered

None.

## Checkpoint: Human Verification Required

Task 3 requires manual verification of the complete admin bug dashboard:
1. Start dev server with `npm run dev`
2. Navigate to /bug-reports as admin user
3. Verify table, filtering, sorting, expandable rows, status workflow, sidebar badge
4. See Task 3 in 36-02-PLAN.md for full verification checklist

## Self-Check: PASSED

- FOUND: components/bug-reports/bug-report-status-badge.tsx
- FOUND: components/bug-reports/bug-report-expanded-row.tsx
- FOUND: components/bug-reports/bug-report-table.tsx
- FOUND: app/(authenticated)/bug-reports/page.tsx
- FOUND: a2ca69a (Task 1 commit)
- FOUND: b2e72f7 (Task 2 commit)

---
*Phase: 36-admin-bug-dashboard*
*Paused at checkpoint: 2026-03-27*
