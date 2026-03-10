---
phase: 29-admin-ui-polish
plan: 01
subsystem: ui
tags: [dropdown-menu, radix-ui, user-identity, sidebar, mobile-nav, logout]

# Dependency graph
requires:
  - phase: 27-auth-flow
    provides: getCurrentUser, session cookie with UserInfo
  - phase: 28-data-isolation
    provides: isAdmin authorization function
provides:
  - UserMenu client component with initials avatar, admin badge, collapse toggle, and logout
  - User identity display in sidebar and mobile nav
  - Logout action via /api/auth/logout redirect
affects: [admin-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-to-client user data flow via layout props]

key-files:
  created:
    - components/layout/user-menu.tsx
  modified:
    - app/(authenticated)/layout.tsx
    - components/layout/app-shell.tsx
    - components/layout/sidebar.tsx
    - components/layout/mobile-nav.tsx

key-decisions:
  - "Server layout fetches user data and passes as props through AppShell to avoid client-side auth calls"
  - "UserMenu replaces old collapse toggle button, combining user identity with sidebar control"

patterns-established:
  - "User data flow: server layout -> AppShell -> Sidebar/MobileNav -> UserMenu (all via props)"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 29 Plan 01: User Menu Summary

**UserMenu component with initials avatar, admin badge, collapse sidebar toggle, and Cognito logout in sidebar and mobile nav**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T20:45:00Z
- **Completed:** 2026-03-10T20:49:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created UserMenu client component with initials avatar circle, user name display, admin badge, collapse/expand toggle, and logout action
- Updated authenticated layout to async server component that fetches user data and passes through AppShell
- Replaced old sidebar collapse toggle button with UserMenu in both desktop sidebar and mobile nav sheet

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UserMenu component and update layout data flow** - `fb34896` (feat)
2. **Task 2: Wire UserMenu into Sidebar and MobileNav** - `6b2d3d7` (feat)

## Files Created/Modified
- `components/layout/user-menu.tsx` - New UserMenu client component with DropdownMenu, initials avatar, admin badge, collapse toggle, logout
- `app/(authenticated)/layout.tsx` - Async server component fetching getCurrentUser and isAdmin, passing to AppShell
- `components/layout/app-shell.tsx` - Extended AppShellProps with user/isAdmin, forwards to Sidebar and MobileNav
- `components/layout/sidebar.tsx` - Replaced collapse toggle button with UserMenu, removed unused imports
- `components/layout/mobile-nav.tsx` - Added MobileNavProps interface with user/isAdmin, added UserMenu at sheet bottom

## Decisions Made
- Server layout fetches user data and passes as props through AppShell to avoid client-side auth calls (lib/auth has "server-only" import)
- UserMenu replaces the old collapse toggle button, combining user identity with sidebar control in a single DropdownMenu
- Mobile nav's onToggle closes the sheet (no sidebar collapse concept on mobile)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build error in `app/(authenticated)/projects/[id]/epics/[epicId]/page.tsx` (implicit `any` type) -- unrelated to this plan, not addressed
- Pre-existing test failures in `infra/test/` (jest reference errors in vitest) -- unrelated, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- User identity and logout are wired end-to-end
- Admin badge displays correctly based on isAdmin check
- Ready for any additional admin UI polish tasks in Phase 29

## Self-Check: PASSED

- All 5 created/modified files verified on disk
- Commit fb34896 verified in git log
- Commit 6b2d3d7 verified in git log

---
*Phase: 29-admin-ui-polish*
*Completed: 2026-03-10*
