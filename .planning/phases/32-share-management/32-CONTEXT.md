# Phase 32: Share Management - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Owner-facing UI for sharing projects and managing collaborators. Project owners can open a share dialog, search for users, add them with a role, change roles, and remove access. Non-owners do not see share controls.

</domain>

<decisions>
## Implementation Decisions

### Share Dialog Trigger & Layout
- **D-01:** Share button lives in the project detail page header, next to project name/actions. Not on project cards.
- **D-02:** Share UI opens as a Radix Dialog (modal), reusing the existing dialog pattern from create-project-dialog.
- **D-03:** Users are added one at a time. After adding, the dialog stays open so the owner can add more. No batch multi-user selection.

### User Picker Behavior
- **D-04:** Search-as-you-type combobox with dropdown results. Queries the local User table (only users who have logged in before).
- **D-05:** Search matches against both email and display name fields.
- **D-06:** Each result row shows display name as primary text and email as secondary text. Falls back to email-only when no display name exists (per Phase 30 D-04).
- **D-07:** No Combobox/Command component exists yet — one must be added (shadcn/ui cmdk pattern or similar).

### Role Assignment & Changes
- **D-08:** Default role when sharing is **editor** (not viewer). Owner explicitly downgrades to viewer if needed.
- **D-09:** Role changes for existing shares use an inline dropdown/toggle next to each user in the share list. Changes take effect immediately (no separate save step).
- **D-10:** Removing a user's access requires a confirmation dialog before executing. Prevents accidental unshares.

### Access Control for Share UI
- **D-11:** Only project owners and admins can open the share dialog and manage collaborators. Editors and viewers cannot share.
- **D-12:** Share button is hidden (not rendered) for non-owners. No disabled state or tooltip — clean absence.
- **D-13:** Access gating uses the `role` field from `getAuthorizedProject` return (Phase 31 D-11). Owner role = show button, admin role = show button, editor/viewer = hide.

### Claude's Discretion
- Exact combobox component choice (shadcn/ui Command, cmdk, or custom) — pick what fits the existing stack best
- Debounce timing for search-as-you-type queries
- Server action vs API route for user search endpoint
- Whether the share dialog shows the current user (owner) in the collaborator list or omits them
- Toast messaging for share/unshare/role-change success/error feedback
- Empty state when no users are shared yet (likely a simple message)
- Whether to exclude users already shared from search results

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Components & Patterns
- `components/ui/dialog.tsx` — Radix Dialog primitives used throughout the app
- `components/projects/create-project-dialog.tsx` — Reference dialog pattern (form, loading state, server action, toast, router)
- `components/ui/input.tsx` — Text input component
- `components/ui/select.tsx` — Select dropdown component
- `components/ui/button.tsx` — Button component with variants

### Authorization (from Phase 31)
- `lib/auth/authorization.ts` — `getAuthorizedProject` returns `{ role, canEdit, isAdmin }` used to gate share UI visibility
- `lib/auth/types.ts` — UserInfo interface

### Data Model
- `prisma/schema.prisma` — User model (email, name), ProjectShare model (projectId, userId, role), Project model with shares relation
- `.planning/phases/30-data-foundation/30-CONTEXT.md` — User table decisions (D-01 through D-12)
- `.planning/phases/31-authorization-refactor/31-CONTEXT.md` — Authorization return shape decisions (D-11 through D-13)

### Server Actions
- `server/actions/projects.ts` — Existing project CRUD actions pattern

### Requirements
- `.planning/REQUIREMENTS.md` — SHARE-01 (share dialog), SHARE-02 (user picker), SHARE-03 (manage roles/remove)
- `.planning/ROADMAP.md` — Phase 32 success criteria

### Codebase Conventions
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, error handling, import organization

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/dialog.tsx` — Radix Dialog (DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger)
- `components/projects/create-project-dialog.tsx` — Full dialog pattern: useState for open/loading, form submission via server action, toast feedback, router refresh
- `components/ui/alert-dialog.tsx` — Alert dialog for confirmations (can be used for remove-access confirmation)
- `sonner` toast library — already used throughout for success/error messages
- `lucide-react` icons — Share2, UserPlus, X, Trash2, etc.

### Established Patterns
- **Dialog pattern:** Controlled open state, form inside DialogContent, server action call, toast on result, close on success
- **Server action error pattern:** `{ success: false, error: "message" }` return shape
- **Loading states:** `useState(false)` + Loader2 spinner icon during async operations
- **Toast feedback:** `toast.success()` / `toast.error()` via sonner

### Integration Points
- Project detail page header — where share button will be added (needs to receive project + role from server component)
- Server actions — new actions for shareProject, unshareProject, updateShareRole, searchUsers
- Prisma queries — User.findMany for search, ProjectShare.create/delete/update for management

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-share-management*
*Context gathered: 2026-03-24*
