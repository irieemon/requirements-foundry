# Phase 36: Admin Bug Dashboard - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-only page at `/bug-reports` for viewing, triaging, and managing all bug reports. Delivers a data table with inline expansion, status workflow controls, admin notes editing, status filtering, date sorting, and an open-count sidebar badge. Does not deliver reporter-facing views, attachments, or real-time updates.

</domain>

<decisions>
## Implementation Decisions

### Report List Layout
- **D-01:** Data table layout using existing `table.tsx` and `table-toolbar.tsx` shadcn components. Consistent with the rest of the app's list pages.
- **D-02:** Table columns: Status (colored badge), Submitter (email), Date (relative), Page URL, Description (truncated ~80 chars with ellipsis).
- **D-03:** Clicking a table row expands it inline below to show: full description, browser metadata summary, status dropdown, admin notes textarea, and a Save button. No page navigation or modal — fast triage workflow.

### Status Workflow UX
- **D-04:** Status changed via Select dropdown in the expanded row. All 4 statuses shown: open, in-progress, resolved, closed. Admin can transition to any status freely (no forward-only restriction).
- **D-05:** Single "Save" button persists both status change and admin notes together in one server action call.
- **D-06:** No confirmation dialog on status change — Save button applies immediately with a success toast. Internal corporate tool, low risk.

### Filtering & Sorting
- **D-07:** Claude's Discretion — implement status filtering and date sorting using existing UI components (Select for filter, table column headers for sort). Follow patterns from requirements ADMIN-04.

### Sidebar Badge & Access
- **D-08:** Claude's Discretion — add Bug Reports nav item to sidebar (admin-only, using `isAdmin` prop). Show open report count badge. Follow ADMIN-05 requirement.

### Claude's Discretion
- Exact status badge colors and icons (emoji or colored dot)
- Expanded row layout details (spacing, metadata formatting)
- Empty state when no bug reports exist
- Pagination approach if list grows large (or no pagination for v5.0)
- Admin notes textarea size and placeholder text
- Server action error handling patterns
- Loading skeleton for initial page load

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Components
- `components/ui/table.tsx` — Base table component (shadcn)
- `components/ui/table-toolbar.tsx` — Table toolbar with filtering/actions
- `components/ui/select.tsx` — Select dropdown for status filter and status change
- `components/ui/badge.tsx` — Badge component for status indicators and sidebar count
- `components/ui/textarea.tsx` — Textarea for admin notes
- `components/ui/skeleton.tsx` — Loading skeleton
- `components/layout/sidebar.tsx` — Sidebar navigation where bug reports link and badge go
- `components/layout/app-shell.tsx` — AppShell that passes `isAdmin` to sidebar

### Reference Implementations
- `components/projects/share-dialog.tsx` — Dialog + server action + toast pattern
- `app/(authenticated)/runs/page.tsx` — List page pattern with status tracking (closest reference)
- `app/(authenticated)/projects/page.tsx` — List page pattern

### Server Actions & Data
- `server/actions/bug-reports.ts` — Existing submitBugReport action (Phase 35) — extend with admin actions
- `server/actions/shares.ts` — Reference for server action pattern with Prisma operations
- `prisma/schema.prisma` — BugReport model with status and createdAt indexes
- `lib/auth/authorization.ts` — Role-based authorization module for admin checks

### Requirements
- `.planning/REQUIREMENTS.md` — ADMIN-01 through ADMIN-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **table.tsx + table-toolbar.tsx**: Shadcn table components ready for data display with sorting
- **Select component**: For status filter dropdown and inline status change dropdown
- **Badge component**: For colored status badges in table rows and sidebar count
- **Textarea component**: For admin notes editing in expanded row
- **Skeleton component**: For loading states
- **Sidebar nav**: Already has `navItems` array and receives `isAdmin` prop — add conditional bug reports link
- **Server actions pattern**: `server/actions/bug-reports.ts` already exists from Phase 35 — extend with `updateBugReport` and `getBugReports` actions
- **Authorization module**: `lib/auth/authorization.ts` provides role-based access control

### Established Patterns
- **List pages**: `/projects` and `/runs` pages show data tables with status indicators
- **Server actions**: Return typed results, client shows toast on success/error
- **Admin checks**: `isAdmin` prop flows through AppShell → Sidebar; server-side via authorization module
- **Status as String**: BugReport.status is a plain string field, not an enum (Phase 34 D-02)

### Integration Points
- **App Router**: New page at `app/(authenticated)/bug-reports/page.tsx`
- **Sidebar**: Add nav item with badge count (admin-only conditional)
- **Server actions**: Extend `server/actions/bug-reports.ts` with getBugReports, updateBugReport
- **Prisma**: BugReport.findMany with status filter and createdAt ordering (indexes exist)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 36-admin-bug-dashboard*
*Context gathered: 2026-03-27*
