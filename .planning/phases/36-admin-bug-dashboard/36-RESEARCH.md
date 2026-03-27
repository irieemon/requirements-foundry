# Phase 36: Admin Bug Dashboard - Research

**Researched:** 2026-03-27
**Domain:** Next.js App Router admin dashboard (data table, server actions, sidebar integration)
**Confidence:** HIGH

## Summary

Phase 36 builds an admin-only bug report dashboard at `/bug-reports`. The codebase already has all necessary infrastructure: the BugReport Prisma model (Phase 34), the `submitBugReport` server action (Phase 35), shadcn UI components (table, select, badge, textarea, skeleton), the authorization module with `isAdmin()`, and established patterns for list pages, server actions, and toast notifications. This phase is purely additive -- no schema changes, no new dependencies, no migrations.

The implementation follows well-established patterns already in the codebase: server component page fetches data via Prisma, client component renders a data table with interactive elements, server actions handle mutations, and `sonner` toast provides user feedback. The sidebar already receives `isAdmin` as a prop and has a `navItems` array that simply needs a new entry with a badge.

**Primary recommendation:** Follow the runs page + shares server action patterns exactly. Build a server component page that fetches bug reports, a client component table with expandable rows, extend `server/actions/bug-reports.ts` with `getBugReports` and `updateBugReport`, and add a conditional nav item with badge count to both sidebar and mobile-nav.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Data table layout using existing `table.tsx` and `table-toolbar.tsx` shadcn components
- **D-02:** Table columns: Status (colored badge), Submitter (email), Date (relative), Page URL, Description (truncated ~80 chars with ellipsis)
- **D-03:** Clicking a table row expands inline below to show: full description, browser metadata summary, status dropdown, admin notes textarea, and Save button. No page navigation or modal.
- **D-04:** Status changed via Select dropdown in expanded row. All 4 statuses: open, in-progress, resolved, closed. Free transitions (no forward-only restriction).
- **D-05:** Single "Save" button persists both status change and admin notes together in one server action call.
- **D-06:** No confirmation dialog on status change -- Save button applies immediately with a success toast.

### Claude's Discretion
- D-07: Status filtering and date sorting using existing UI components
- D-08: Bug Reports nav item in sidebar (admin-only, using isAdmin prop) with open report count badge
- Exact status badge colors and icons
- Expanded row layout details
- Empty state when no bug reports exist
- Pagination approach (or no pagination for v5.0)
- Admin notes textarea size and placeholder text
- Server action error handling patterns
- Loading skeleton for initial page load

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-01 | Admin can view all bug reports on /bug-reports page showing submitter, date, page URL, description, and status | Server component page pattern from runs/page.tsx; Prisma findMany with orderBy on BugReport model; table components ready |
| ADMIN-02 | Admin can update bug report status (open -> in-progress -> resolved -> closed) | Extend bug-reports.ts with updateBugReport server action; Select component for dropdown; free transitions per D-04 |
| ADMIN-03 | Admin can add internal notes to bug reports | BugReport.adminNotes field exists (String? @db.Text); Textarea component; combined save with status per D-05 |
| ADMIN-04 | Admin can filter reports by status and sort by date | TableToolbar + Select for filter; client-side or query-param filtering; createdAt index exists for sorting |
| ADMIN-05 | Admin sees open report count badge in sidebar | Sidebar receives isAdmin prop; Badge component; server action or RSC data prop for count; both sidebar.tsx and mobile-nav.tsx need updates |
</phase_requirements>

## Standard Stack

### Core (already in project -- no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.x | Page routing, server components, server actions | Project framework |
| Prisma Client | 7.2.x | Database queries (BugReport model) | Project ORM |
| shadcn/ui (table, select, badge, textarea, skeleton) | latest | UI components | Project UI library |
| sonner | installed | Toast notifications | Project toast library |
| lucide-react | installed | Icons (Bug icon for sidebar nav) | Project icon library |
| date-fns or built-in | installed | Relative date formatting | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.x | Badge variant styling for status colors | Status badge customization |

### Alternatives Considered
None -- all needed components already exist in the codebase. No new dependencies required.

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
app/(authenticated)/bug-reports/
  page.tsx                          # Server component: fetch data, admin guard, render client component
components/bug-reports/
  bug-report-table.tsx              # Client component: data table with expandable rows, filter, sort
  bug-report-expanded-row.tsx       # Client component: expanded row with status select, notes textarea, save
  bug-report-status-badge.tsx       # Shared component: colored status badge (reused in table + expanded)
server/actions/
  bug-reports.ts                    # EXTEND existing file: add getBugReports, updateBugReport, getOpenBugReportCount
components/layout/
  sidebar.tsx                       # MODIFY: add Bug Reports nav item with badge (admin-only)
  mobile-nav.tsx                    # MODIFY: add Bug Reports nav item with badge (admin-only)
```

### Pattern 1: Server Component Page with Admin Guard
**What:** The page.tsx is a server component that checks admin status and fetches data before rendering.
**When to use:** All admin-only pages.
**Example:**
```typescript
// Source: app/(authenticated)/runs/page.tsx pattern
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { getBugReports } from "@/server/actions/bug-reports";

export default async function BugReportsPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    redirect("/projects"); // Non-admins redirected
  }
  const reports = await getBugReports();
  return <BugReportTable reports={reports} />;
}
```

### Pattern 2: Server Action with Admin Check (extend existing file)
**What:** Server actions that verify admin status before performing mutations.
**When to use:** All admin write operations.
**Example:**
```typescript
// Source: server/actions/shares.ts pattern
"use server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { revalidatePath } from "next/cache";

export async function updateBugReport(
  reportId: string,
  data: { status: string; adminNotes: string | null }
) {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    return { success: false as const, error: "Unauthorized" };
  }
  await db.bugReport.update({
    where: { id: reportId },
    data: { status: data.status, adminNotes: data.adminNotes },
  });
  revalidatePath("/bug-reports");
  return { success: true as const };
}
```

### Pattern 3: Expandable Table Row (client-side state)
**What:** Clicking a row toggles an expanded section below it using React state. No routing or modals.
**When to use:** Inline editing without page navigation (D-03).
**Example:**
```typescript
// Client component pattern
const [expandedId, setExpandedId] = useState<string | null>(null);

{reports.map((report) => (
  <React.Fragment key={report.id}>
    <TableRow
      className="cursor-pointer"
      onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
    >
      {/* ... columns ... */}
    </TableRow>
    {expandedId === report.id && (
      <TableRow>
        <TableCell colSpan={5}>
          <BugReportExpandedRow report={report} />
        </TableCell>
      </TableRow>
    )}
  </React.Fragment>
))}
```

### Pattern 4: Client-Side Filtering with URL Search Params
**What:** Status filter and date sort managed via client state (or URL search params for shareability).
**When to use:** Simple filtering on small datasets.
**Recommendation:** Use client-side filtering since the dataset is small (corporate internal tool, unlikely to have hundreds of reports). Avoid over-engineering with server-side pagination for v5.0.

### Anti-Patterns to Avoid
- **Over-engineering pagination:** For an internal corporate tool, bug reports will be in the tens, not thousands. Simple client-side filtering is sufficient for v5.0.
- **Separate detail page per report:** D-03 explicitly says inline expansion, not page navigation.
- **Confirmation dialogs on save:** D-06 explicitly says no confirmation -- direct save with toast.
- **Forward-only status transitions:** D-04 explicitly says free transitions to any status.
- **Fetching badge count via separate API route:** Use a server action called from the layout or pass as prop. The sidebar is a client component but the layout is a server component that can fetch the count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table UI | Custom table markup | shadcn Table + TableToolbar components | Already exist, consistent with rest of app |
| Status dropdown | Custom dropdown | shadcn Select component | Already exists, accessible, consistent |
| Toast notifications | Custom notification system | sonner toast | Already wired up in app |
| Status badge colors | Inline conditional styles | Badge component with variant + custom className | Consistent with rest of app |
| Relative date display | Manual date math | date-fns `formatDistanceToNow` or similar | Already available in project |
| Admin authorization | Custom auth check | `isAdmin()` from `lib/auth/authorization.ts` | Centralized, tested |

**Key insight:** Every UI component and pattern needed already exists in the codebase. This phase is assembly, not invention.

## Common Pitfalls

### Pitfall 1: Forgetting mobile-nav.tsx when adding sidebar items
**What goes wrong:** Bug Reports nav item appears in desktop sidebar but not in mobile hamburger menu.
**Why it happens:** The sidebar and mobile-nav have separate `navItems` arrays (not shared).
**How to avoid:** Update BOTH `components/layout/sidebar.tsx` AND `components/layout/mobile-nav.tsx` with the new nav item and badge.
**Warning signs:** Testing only on desktop; missing mobile QA.

### Pitfall 2: Badge count stale after status update
**What goes wrong:** Admin updates a report status from "open" to "resolved" but the sidebar badge still shows the old count.
**Why it happens:** The badge count was fetched once on page load and not revalidated after mutation.
**How to avoid:** Call `revalidatePath("/bug-reports")` in the updateBugReport action AND use `router.refresh()` after successful save to refresh server component data. The sidebar count should come from server component data that gets revalidated.
**Warning signs:** Badge count not decrementing after resolving reports.

### Pitfall 3: Sidebar badge count needs server data in client component
**What goes wrong:** The Sidebar is a "use client" component and cannot directly call Prisma.
**Why it happens:** Sidebar receives props from AppShell, which receives props from the server component layout.
**How to avoid:** Add `openBugReportCount` prop to AppShell and Sidebar interfaces. Fetch the count in `app/(authenticated)/layout.tsx` (server component) and pass it down. Only fetch when user is admin.
**Warning signs:** Trying to call server actions in useEffect for badge count (works but causes waterfall).

### Pitfall 4: Textarea losing content on row collapse
**What goes wrong:** Admin types notes, accidentally clicks another row, loses typed content.
**Why it happens:** Expanding a different row unmounts the previous expanded row component.
**How to avoid:** Either (a) use controlled state at the table level that preserves edits, or (b) warn before collapsing a dirty row. Simplest: keep a Map of pending edits keyed by report ID.
**Warning signs:** User frustration during triage.

### Pitfall 5: Not guarding the page server-side
**What goes wrong:** Non-admin users can access `/bug-reports` by typing the URL directly.
**Why it happens:** Only checking isAdmin in the sidebar (hiding the link) but not in the page component.
**How to avoid:** Add `isAdmin` check in the page.tsx server component with redirect to `/projects` for non-admins.
**Warning signs:** Security review failure.

## Code Examples

### Status Badge Color Mapping
```typescript
// Source: Codebase convention with Badge component
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20" },
  "in-progress": { label: "In Progress", className: "bg-blue-500/15 text-blue-700 border-blue-500/20" },
  resolved: { label: "Resolved", className: "bg-green-500/15 text-green-700 border-green-500/20" },
  closed: { label: "Closed", className: "bg-gray-500/15 text-gray-500 border-gray-500/20" },
};

function BugReportStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
```

### Server Action: Get Bug Reports
```typescript
// Source: Pattern from runs/page.tsx + shares.ts
export async function getBugReports(statusFilter?: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    return [];
  }
  return db.bugReport.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
  });
}
```

### Server Action: Get Open Count for Badge
```typescript
export async function getOpenBugReportCount() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) return 0;
  return db.bugReport.count({ where: { status: "open" } });
}
```

### Sidebar Badge Pattern
```typescript
// In sidebar navItems -- conditional for admin
const navItems = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/runs", label: "Runs", icon: Activity },
  // Admin-only items added conditionally:
  ...(isAdmin ? [{
    href: "/bug-reports",
    label: "Bug Reports",
    icon: Bug, // from lucide-react
    badge: openBugReportCount > 0 ? openBugReportCount : undefined,
  }] : []),
];
```

### Expanded Row Save Handler
```typescript
// Source: Pattern from share-dialog.tsx
const handleSave = async () => {
  setSaving(true);
  const result = await updateBugReport(report.id, {
    status: selectedStatus,
    adminNotes: notes,
  });
  if (result.success) {
    toast.success("Bug report updated");
    router.refresh();
  } else {
    toast.error(result.error || "Failed to update bug report");
  }
  setSaving(false);
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API routes for mutations | Server actions ("use server") | Next.js 14+ | This project uses server actions exclusively |
| Client-side data fetching | Server component data fetching | Next.js 13+ App Router | Page.tsx fetches, passes to client components |
| useRouter().push for refresh | router.refresh() | Next.js 13+ | Refreshes server component data without navigation |

**Deprecated/outdated:**
- None relevant -- the project is on current Next.js patterns

## Open Questions

1. **Relative date formatting utility**
   - What we know: The project likely uses date-fns or a similar utility. Need to verify which date formatting function is already used elsewhere.
   - What's unclear: Whether `formatDistanceToNow` from date-fns is already imported anywhere.
   - Recommendation: Check imports during implementation; if no date library, use `Intl.RelativeTimeFormat` or a simple helper.

2. **Badge count refresh on navigation**
   - What we know: The sidebar badge count is passed from the server layout. It refreshes when the page revalidates.
   - What's unclear: Whether navigating between pages (e.g., /projects to /bug-reports) triggers a layout re-render that updates the count.
   - Recommendation: Accept that the count may be slightly stale during a session. `revalidatePath` on mutations ensures eventual consistency. For v5.0, this is acceptable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.mts) |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run server/actions/__tests__/bug-reports.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | getBugReports returns all reports for admin, empty for non-admin | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Exists (extend) |
| ADMIN-02 | updateBugReport changes status, rejects non-admin | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Exists (extend) |
| ADMIN-03 | updateBugReport persists adminNotes field | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Exists (extend) |
| ADMIN-04 | getBugReports respects status filter param | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Exists (extend) |
| ADMIN-05 | getOpenBugReportCount returns count for admin, 0 for non-admin | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run server/actions/__tests__/bug-reports.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extend `server/actions/__tests__/bug-reports.test.ts` with tests for getBugReports, updateBugReport, getOpenBugReportCount
- [ ] Add mock for `isAdmin` in existing bug-reports test file (currently only tests submitBugReport which does not need admin check)
- [ ] Add mock for `revalidatePath` from `next/cache`

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- all referenced files read directly:
  - `prisma/schema.prisma` -- BugReport model confirmed with status, adminNotes, indexes
  - `server/actions/bug-reports.ts` -- existing submitBugReport action to extend
  - `server/actions/shares.ts` -- server action pattern reference (auth check, db op, revalidate, return typed result)
  - `app/(authenticated)/runs/page.tsx` -- list page pattern reference
  - `components/layout/sidebar.tsx` -- navItems array, isAdmin prop, tooltip pattern
  - `components/layout/mobile-nav.tsx` -- separate navItems array needing parallel update
  - `components/layout/app-shell.tsx` -- passes isAdmin to Sidebar and MobileNav
  - `app/(authenticated)/layout.tsx` -- server component that creates AppShell with isAdmin
  - `lib/auth/authorization.ts` -- isAdmin(), ADMIN_EMAIL, getAuthorizedProject pattern
  - `components/ui/table.tsx` -- shadcn table components
  - `components/ui/table-toolbar.tsx` -- TableToolbar, TableToolbarLeft, TableToolbarRight, TableContainer
  - `components/ui/select.tsx` -- Radix Select components
  - `components/ui/badge.tsx` -- Badge with variant support
  - `components/projects/share-dialog.tsx` -- dialog + server action + toast pattern
  - `server/actions/__tests__/bug-reports.test.ts` -- existing test file to extend
  - `vitest.config.mts` -- test configuration confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase, verified by direct reading
- Architecture: HIGH -- follows exact patterns already used in runs page, shares dialog, and authorization module
- Pitfalls: HIGH -- identified from direct codebase analysis (separate sidebar/mobile-nav, client/server boundary for badge count)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependencies, pure codebase patterns)
