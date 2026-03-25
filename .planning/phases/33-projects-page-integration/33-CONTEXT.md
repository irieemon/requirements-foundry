# Phase 33: Projects Page Integration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

User-facing display of shared projects with role and owner context. The projects page shows "Shared with me" as a distinct section below "My Projects". Each shared project card displays the user's role (viewer/editor) as a badge and the project owner's display name. The runs page includes runs from shared projects the user has access to.

</domain>

<decisions>
## Implementation Decisions

### Section Layout
- **D-01:** Projects page uses stacked sections: "My Projects" header followed by owned projects grid, then "Shared with me" header followed by shared projects grid.
- **D-02:** `getAuthorizedProjects` must return owned and shared projects as separate arrays (currently merges them). Change return shape to `{ ownedProjects, sharedProjects, user, isAdmin }`.
- **D-03:** When the user has no shared projects, the "Shared with me" section is hidden entirely (not shown with empty state). Section appears only when shares exist.
- **D-04:** Admin "View All" toggle continues to show all projects in a single merged list (existing behavior preserved). The owned/shared split only applies to the normal user view.

### Role Badge on Shared Cards
- **D-05:** Each shared project card displays a role badge using the existing `Badge` component.
- **D-06:** Badge variants: `outline` for "Viewer", `secondary` for "Editor". This provides visual differentiation — editors have a more prominent badge.
- **D-07:** Badge position: top-right area of the card, near the project name. Consistent with the content count badges already on cards.

### Owner Display on Shared Cards
- **D-08:** Shared project cards show "Shared by {owner name}" as a subtitle line below the project name.
- **D-09:** Owner name comes from looking up the User record by `Project.userId` (email) — requires including owner User data in the shared projects query.
- **D-10:** Falls back to owner's email when no display name exists (consistent with Phase 30 D-04 fallback pattern).
- **D-11:** Owned project cards do NOT show "Shared by" — only shared cards display this.

### Runs Page Integration
- **D-12:** Runs page query expands to include runs from projects the user has access to via ProjectShare, not just owned projects.
- **D-13:** Runs from shared projects appear mixed into the same chronological list (no separate section).
- **D-14:** The project name column (already supported via `showProject`) displays for all runs on the runs page. Each run shows its own project name (currently RunList uses a single `projectName` prop — needs per-run project name).

### ProjectCard Interface Extension
- **D-15:** `ProjectCardProps.project` gains optional fields: `role` (string), `ownerName` (string). These are only populated for shared projects.
- **D-16:** The existing `ownerLabel` prop (used for admin view) is separate from `ownerName` on shared cards. Both can coexist — admin view shows email, shared view shows display name.

### Claude's Discretion
- Exact badge color/styling within the variant system
- Whether to add a small icon (e.g., Users icon) next to the "Shared by" text
- RunList refactor approach — whether to pass projectName per-run or restructure the component interface
- Whether the "Shared with me" section header includes a count badge (e.g., "Shared with me (3)")
- Loading skeleton layout for the two-section page
- Sort order within each section (currently createdAt desc — keep or allow different)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projects Page & Cards
- `app/(authenticated)/projects/page.tsx` — Server component that calls getAuthorizedProjects and renders ProjectList
- `components/projects/project-list.tsx` — Grid layout for project cards, currently single flat list
- `components/projects/project-card.tsx` — Card component with ownerLabel prop, content badges, delete menu

### Runs Page
- `app/(authenticated)/runs/page.tsx` — Runs query using project.userId filter (needs expansion for shared projects)
- `components/runs/run-list.tsx` — Table display with single projectName prop (needs per-run project names)

### Authorization
- `lib/auth/authorization.ts` — getAuthorizedProjects returns merged array with role annotations; getAuthorizedProject returns { role, canEdit, isAdmin }
- `lib/auth/types.ts` — UserInfo interface

### Data Model
- `prisma/schema.prisma` — User model (email, name), ProjectShare model, Project model with userId as email string
- `.planning/phases/30-data-foundation/30-CONTEXT.md` — User identity decisions (D-01 through D-12), especially D-04 (email fallback for missing name)

### UI Components
- `components/ui/badge.tsx` — Badge component with variants: default, secondary, destructive, outline
- `components/ui/card.tsx` — Card primitives used in project cards

### Requirements
- `.planning/REQUIREMENTS.md` — PAGE-01 (shared section), PAGE-02 (role badge), PAGE-03 (owner name)
- `.planning/ROADMAP.md` — Phase 33 success criteria including runs page requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/badge.tsx` — Badge with outline/secondary variants for role display
- `components/projects/project-card.tsx` — Already supports `ownerLabel` prop for admin view; extend for shared card owner display
- `components/projects/project-list.tsx` — Grid layout; needs section headers but grid pattern is reusable
- `lib/auth/authorization.ts` — getAuthorizedProjects already queries owned and shared separately internally; split return is minimal change

### Established Patterns
- **Admin view toggle** — AdminViewToggle component with viewAll state passed to getAuthorizedProjects
- **Server component data fetching** — Projects page is a server component; data arrives before render
- **Content badge pattern** — Project cards show upload/card/epic/run counts as Badge secondary variants
- **ownerLabel pattern** — Admin view passes `ownerLabel` string to cards; similar approach for shared owner display
- **Clean absence** — Phase 32 D-12 established hiding controls rather than disabling them

### Integration Points
- `getAuthorizedProjects()` return shape change — affects projects page.tsx (primary consumer)
- `ProjectCardProps` interface expansion — role and ownerName fields
- Runs page query — needs OR condition for owned + shared projects
- RunList component — needs per-run project name instead of single prop

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- **PAGE-04 (v4.x):** In-app indicator for newly shared projects — requires tracking "seen" state
- **PAGE-05 (v4.x):** Share count on owned project cards — shows how many users a project is shared with
- **Shared project sorting:** Allow sorting shared projects by role or date shared — add if users request it

</deferred>

---

*Phase: 33-projects-page-integration*
*Context gathered: 2026-03-25*
