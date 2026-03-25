# Phase 33: Projects Page Integration - Research

**Researched:** 2026-03-25
**Domain:** Next.js server components, Prisma queries, React UI composition
**Confidence:** HIGH

## Summary

Phase 33 is a UI integration phase that surfaces data already available from Phases 30-32 (User table, ProjectShare records, authorization module) into the projects page and runs page. The work involves three distinct changes: (1) restructuring `getAuthorizedProjects` to return owned and shared projects as separate arrays, (2) extending the project card component to display role badges and owner names for shared projects, and (3) expanding the runs page query to include runs from shared projects.

All required data models, authorization logic, and UI primitives already exist. No new libraries, migrations, or external dependencies are needed. The primary risk is breaking the existing admin view or introducing TypeScript type errors when changing the `getAuthorizedProjects` return shape.

**Primary recommendation:** Implement in three sequential steps: data layer return shape change, projects page UI split, then runs page expansion. Each step is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Projects page uses stacked sections: "My Projects" header followed by owned projects grid, then "Shared with me" header followed by shared projects grid.
- **D-02:** `getAuthorizedProjects` must return owned and shared projects as separate arrays (currently merges them). Change return shape to `{ ownedProjects, sharedProjects, user, isAdmin }`.
- **D-03:** When the user has no shared projects, the "Shared with me" section is hidden entirely (not shown with empty state). Section appears only when shares exist.
- **D-04:** Admin "View All" toggle continues to show all projects in a single merged list (existing behavior preserved). The owned/shared split only applies to the normal user view.
- **D-05:** Each shared project card displays a role badge using the existing `Badge` component.
- **D-06:** Badge variants: `outline` for "Viewer", `secondary` for "Editor". This provides visual differentiation -- editors have a more prominent badge.
- **D-07:** Badge position: top-right area of the card, near the project name. Consistent with the content count badges already on cards.
- **D-08:** Shared project cards show "Shared by {owner name}" as a subtitle line below the project name.
- **D-09:** Owner name comes from looking up the User record by `Project.userId` (email) -- requires including owner User data in the shared projects query.
- **D-10:** Falls back to owner's email when no display name exists (consistent with Phase 30 D-04 fallback pattern).
- **D-11:** Owned project cards do NOT show "Shared by" -- only shared cards display this.
- **D-12:** Runs page query expands to include runs from projects the user has access to via ProjectShare, not just owned projects.
- **D-13:** Runs from shared projects appear mixed into the same chronological list (no separate section).
- **D-14:** The project name column (already supported via `showProject`) displays for all runs on the runs page. Each run shows its own project name (currently RunList uses a single `projectName` prop -- needs per-run project name).
- **D-15:** `ProjectCardProps.project` gains optional fields: `role` (string), `ownerName` (string). These are only populated for shared projects.
- **D-16:** The existing `ownerLabel` prop (used for admin view) is separate from `ownerName` on shared cards. Both can coexist -- admin view shows email, shared view shows display name.

### Claude's Discretion
- Exact badge color/styling within the variant system
- Whether to add a small icon (e.g., Users icon) next to the "Shared by" text
- RunList refactor approach -- whether to pass projectName per-run or restructure the component interface
- Whether the "Shared with me" section header includes a count badge (e.g., "Shared with me (3)")
- Loading skeleton layout for the two-section page
- Sort order within each section (currently createdAt desc -- keep or allow different)

### Deferred Ideas (OUT OF SCOPE)
- **PAGE-04 (v4.x):** In-app indicator for newly shared projects -- requires tracking "seen" state
- **PAGE-05 (v4.x):** Share count on owned project cards -- shows how many users a project is shared with
- **Shared project sorting:** Allow sorting shared projects by role or date shared -- add if users request it
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAGE-01 | User can see shared projects in a separate "Shared with me" section | Supported by D-01/D-02/D-03: `getAuthorizedProjects` already queries owned and shared separately; change return shape to expose them as separate arrays; project-list renders two grid sections |
| PAGE-02 | User can see their role (viewer/editor) as a badge on shared project cards | Supported by D-05/D-06/D-07: Badge component exists with outline/secondary variants; role already annotated on shared projects from authorization.ts |
| PAGE-03 | User can see the project owner's name on shared project cards | Supported by D-08/D-09/D-10: Requires joining User table on Project.userId in shared projects query; User.name with email fallback |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Next.js (App Router) | Server components, page rendering | Project framework |
| Prisma | Database queries, type-safe ORM | Project ORM |
| shadcn/ui (Badge, Card) | UI primitives for badges and cards | Project component library |
| lucide-react | Icons | Project icon library |
| date-fns | Date formatting | Already used in project cards and run list |

### No New Dependencies Required
This phase uses only existing project infrastructure. No `npm install` needed.

## Architecture Patterns

### Current Project Structure (relevant files)
```
lib/auth/
  authorization.ts      # getAuthorizedProjects (MODIFY return shape)
  types.ts              # UserInfo interface (no change)
app/(authenticated)/
  projects/page.tsx     # Server component (MODIFY to handle split arrays)
  runs/page.tsx         # Server component (MODIFY query for shared project runs)
components/projects/
  project-list.tsx      # Grid layout (MODIFY to render two sections)
  project-card.tsx      # Card component (MODIFY to add role badge + owner name)
components/runs/
  run-list.tsx          # Table component (MODIFY per-run project name)
```

### Pattern 1: Split Return Shape for getAuthorizedProjects

**What:** Change `getAuthorizedProjects` to return `{ ownedProjects, sharedProjects, user, isAdmin }` instead of merged `{ projects, user, isAdmin }`.

**Current code (authorization.ts lines 185-189):**
```typescript
return {
  projects: [...annotatedOwned, ...annotatedShared],
  user,
  isAdmin: admin,
};
```

**New return shape:**
```typescript
// Normal user view: separate arrays
return {
  ownedProjects: annotatedOwned,
  sharedProjects: annotatedShared,
  user,
  isAdmin: admin,
};

// Admin viewAll: ownedProjects has all, sharedProjects empty
return {
  ownedProjects: projects.map(p => ({ ...p, role: "admin" as ProjectRole })),
  sharedProjects: [],
  user,
  isAdmin: true,
};
```

**Key insight:** The function already queries owned and shared projects separately (lines 138-167) and merges them at the end. Splitting the return is a minimal change -- the real work is updating every consumer.

**Consumer impact:** Only `app/(authenticated)/projects/page.tsx` calls `getAuthorizedProjects`. Single consumer = safe change.

### Pattern 2: Owner Name Lookup for Shared Projects

**What:** Include the project owner's User record in the shared projects query to get display name.

**Current shared projects query (authorization.ts lines 149-166) includes:**
- `_count` for uploads/cards/epics/runs
- `shares` filtered to current user for role

**Needs addition:** Include owner User data via a relation or separate lookup.

**Challenge:** `Project.userId` is an email string, not a FK to User. There is no Prisma relation from Project to User. Two approaches:

1. **Separate lookup (recommended):** After fetching shared projects, collect unique `userId` emails, batch-fetch User records, map name onto each project.
2. **Raw SQL join:** Use `$queryRaw` to join Project with User on email. More efficient but loses Prisma typing.

**Recommendation:** Use approach 1 (separate lookup). It follows the established two-query pattern from Phase 31 (D-04 in STATE.md: "Two-query approach for User lookup + Project with shares (pragmatic over raw SQL)"). The extra query is trivial -- shared projects are typically few (< 20).

```typescript
// After fetching sharedProjects:
const ownerEmails = [...new Set(sharedProjects.map(p => p.userId))];
const owners = await db.user.findMany({
  where: { email: { in: ownerEmails } },
  select: { email: true, name: true },
});
const ownerMap = new Map(owners.map(o => [o.email, o.name || o.email]));

// Then annotate:
const annotatedShared = sharedProjects.map(p => ({
  ...rest,
  role: shareRole,
  ownerName: ownerMap.get(p.userId) || p.userId, // fallback to email
}));
```

### Pattern 3: Two-Section ProjectList

**What:** ProjectList renders "My Projects" and "Shared with me" as separate headed sections.

```typescript
// project-list.tsx receives two arrays:
interface ProjectListProps {
  ownedProjects: ProjectWithMeta[];
  sharedProjects: ProjectWithMeta[];
}

// Render:
<>
  <h2>My Projects</h2>
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {ownedProjects.map(p => <ProjectCard key={p.id} project={p} />)}
  </div>
  {sharedProjects.length > 0 && (
    <>
      <h2>Shared with me</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sharedProjects.map(p => <ProjectCard key={p.id} project={p} />)}
      </div>
    </>
  )}
</>
```

**Empty state handling:**
- No owned projects + no shared: show existing EmptyState with "Create your first project"
- Owned projects exist but no shared: show only "My Projects" section (D-03)
- Both exist: show both sections

### Pattern 4: Per-Run Project Name in RunList

**What:** Change RunList to use per-run `projectName` instead of a single `projectName` prop.

**Current interface:**
```typescript
interface Run {
  id: string; type: string; status: string; /* ... */
}
interface RunListProps {
  runs: Run[];
  showProject?: boolean;
  projectName?: string; // Single name for all runs
}
```

**Problem:** Line 165 renders `{projectName || "-"}` for every row -- same name for all runs. Works on project detail page (single project), broken on runs page (multiple projects).

**Solution:** Add `projectName` to the `Run` interface:
```typescript
interface Run {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokensUsed: number | null;
  errorMsg: string | null;
  projectName?: string; // Per-run project name (used when showProject=true)
}
```

Then line 165 changes to: `{run.projectName || projectName || "-"}` -- backward compatible, falls back to prop if per-run name not set.

**Runs page query expansion (runs/page.tsx):**
```typescript
// Current: only owned projects
const where = isAdmin(user.email) ? {} : { project: { userId: user.email } };

// New: owned + shared projects
const dbUser = await db.user.findUnique({
  where: { email: user.email },
  select: { id: true },
});
const where = isAdmin(user.email)
  ? {}
  : {
      OR: [
        { project: { userId: user.email } },
        ...(dbUser ? [{ project: { shares: { some: { userId: dbUser.id } } } }] : []),
      ],
    };
```

### Anti-Patterns to Avoid
- **Merging then splitting:** Don't merge owned+shared in authorization.ts and then try to split them in the page component. Let the data layer return them separately.
- **N+1 owner lookups:** Don't query User for each shared project individually. Batch-fetch all owner names in one query.
- **Breaking admin view:** The admin "viewAll" code path must continue to return a flat list. Don't force it through the two-section UI.
- **Conditional delete menu:** Viewers should not see the delete option on shared cards. The current card always shows delete -- needs to be hidden when `role` is "viewer" or "editor" (only owners/admins can delete).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role badge styling | Custom badge CSS | `Badge` with variant="outline"/"secondary" | Consistent with existing badge usage across cards |
| Owner name display | Custom user lookup utility | Prisma `findMany` with `in` filter | Standard Prisma pattern, follows Phase 31 precedent |
| Section headers | Custom heading component | Standard h2/h3 with Tailwind | Matches project simplicity; no need for abstraction |

## Common Pitfalls

### Pitfall 1: TypeScript Type Mismatch After Return Shape Change
**What goes wrong:** Changing `getAuthorizedProjects` return from `{ projects }` to `{ ownedProjects, sharedProjects }` causes type errors in the projects page.
**Why it happens:** The destructured `{ projects }` on line 15 of page.tsx will error. The `annotatedProjects` mapping also needs updating.
**How to avoid:** Change authorization.ts and page.tsx in the same step. Run `npx tsc --noEmit` after the change.
**Warning signs:** Build failure, red squiggles in page.tsx.

### Pitfall 2: Admin viewAll Regression
**What goes wrong:** Admin "View All" mode breaks because it's forced through the two-section layout.
**Why it happens:** D-04 requires admin viewAll to continue showing a single merged list.
**How to avoid:** When `isAdmin && viewAll`, return all projects as `ownedProjects` with empty `sharedProjects`. The page should detect admin+viewAll and render single flat list (existing ProjectList behavior).
**Warning signs:** Admin sees "My Projects" / "Shared with me" split when in viewAll mode.

### Pitfall 3: Delete Menu Visible to Viewers
**What goes wrong:** Shared project cards show the delete dropdown for viewers/editors who cannot delete.
**Why it happens:** ProjectCard currently always renders the DropdownMenu with Delete. No role check exists.
**How to avoid:** Conditionally render the dropdown menu based on role. Only show for owner/admin. This is an important UX consideration even though it's not explicitly in the requirements.
**Warning signs:** Viewer clicks delete, gets a 403 or silent failure.

### Pitfall 4: Missing User Record for Owner Lookup
**What goes wrong:** `ownerMap.get(email)` returns undefined because project owner never logged in (no User record).
**Why it happens:** User table is populated on login (Phase 30). A project created before Phase 30 deployment may have userId with no matching User record.
**How to avoid:** D-10 specifies fallback to email. Always use `ownerMap.get(p.userId) || p.userId`.
**Warning signs:** "Shared by undefined" displayed on card.

### Pitfall 5: RunList Backward Compatibility
**What goes wrong:** Adding `projectName` to Run interface breaks existing usages where runs are mapped from Prisma results without projectName.
**Why it happens:** Other pages pass runs to RunList without projectName field.
**How to avoid:** Make `projectName` optional in the Run interface. Keep the existing `projectName` prop as fallback. Line renders `{run.projectName || projectName || "-"}`.
**Warning signs:** TypeScript errors in run detail page or project detail page that also use RunList.

## Code Examples

### Role Badge on Shared Project Card
```typescript
// In project-card.tsx CardHeader, near the project name:
{project.role && project.role !== "owner" && project.role !== "admin" && (
  <Badge variant={project.role === "editor" ? "secondary" : "outline"} className="text-xs">
    {project.role === "editor" ? "Editor" : "Viewer"}
  </Badge>
)}
```

### Owner Name Subtitle on Shared Card
```typescript
// In project-card.tsx, below CardDescription:
{project.ownerName && (
  <p className="text-xs text-muted-foreground">
    Shared by {project.ownerName}
  </p>
)}
```

### Runs Page OR Query for Shared Projects
```typescript
// In runs/page.tsx:
const user = await getCurrentUser();
const admin = isAdmin(user.email);

let where: Prisma.RunWhereInput = {};
if (!admin) {
  const dbUser = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  where = {
    OR: [
      { project: { userId: user.email } },
      ...(dbUser
        ? [{ project: { shares: { some: { userId: dbUser.id } } } }]
        : []),
    ],
  };
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.mts) |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run lib/auth/__tests__/authorization.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | getAuthorizedProjects returns separate ownedProjects/sharedProjects arrays | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProjects"` | Exists (needs new test cases) |
| PAGE-01 | Admin viewAll returns flat list in ownedProjects | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "admin viewAll"` | Exists (needs new test cases) |
| PAGE-02 | Shared projects include role annotation | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "shared.*role"` | Exists (verify current coverage) |
| PAGE-03 | Shared projects include ownerName from User table | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "ownerName"` | Wave 0 |
| PAGE-01/02/03 | Projects page renders two sections with badges and owner names | manual-only | Visual inspection in browser | N/A |
| D-12 | Runs page shows runs from shared projects | manual-only | Visual inspection in browser | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/auth/__tests__/authorization.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add test cases in `lib/auth/__tests__/authorization.test.ts` for new return shape `{ ownedProjects, sharedProjects }`
- [ ] Add test case for ownerName inclusion in shared projects
- [ ] Add test case for admin viewAll still returning flat list (as ownedProjects)
- [ ] Add test case for email fallback when User.name is null

## Open Questions

1. **Delete menu visibility for shared projects**
   - What we know: D-05 through D-16 don't explicitly address hiding the delete menu for non-owners
   - What's unclear: Should shared cards show no dropdown at all, or show a dropdown with different options?
   - Recommendation: Hide the entire dropdown menu on shared cards (viewers/editors cannot delete). This follows Phase 32's D-12 pattern of hiding controls rather than disabling them. The card's `role` field enables this check.

2. **RunList consumers beyond runs page**
   - What we know: RunList is used on the runs page (with `showProject`) and likely on project detail pages (without `showProject`, with single `projectName`)
   - What's unclear: Are there other consumers that might break?
   - Recommendation: Grep for `<RunList` imports before changing the interface. The backward-compatible `run.projectName || projectName || "-"` approach handles all cases.

## Sources

### Primary (HIGH confidence)
- `lib/auth/authorization.ts` -- current getAuthorizedProjects implementation, lines 110-189
- `app/(authenticated)/projects/page.tsx` -- current projects page, sole consumer
- `app/(authenticated)/runs/page.tsx` -- current runs query with userId filter
- `components/projects/project-card.tsx` -- current card with ownerLabel pattern
- `components/runs/run-list.tsx` -- current RunList with single projectName prop
- `prisma/schema.prisma` -- User, Project, ProjectShare models
- `components/ui/badge.tsx` -- Badge variants: default, secondary, destructive, outline
- `lib/auth/__tests__/authorization.test.ts` -- existing test patterns with vi.mock

### Secondary (MEDIUM confidence)
- `.planning/phases/33-projects-page-integration/33-CONTEXT.md` -- all 16 decisions + discretion areas
- `.planning/STATE.md` -- accumulated project decisions and patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all components already exist
- Architecture: HIGH -- direct code inspection of all affected files, clear modification paths
- Pitfalls: HIGH -- identified from actual code patterns (admin viewAll, TypeScript types, N+1 queries, missing User records)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no external dependency changes expected)
