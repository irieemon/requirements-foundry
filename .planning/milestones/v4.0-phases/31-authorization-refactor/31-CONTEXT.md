# Phase 31: Authorization Refactor - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the centralized authorization module to resolve explicit roles (owner/editor/viewer/admin) from ProjectShare records, enforce viewer restrictions on all mutations server-side, consolidate inline auth checks from API routes, and return role-aware data from all authorization functions. No UI changes — server-side authorization logic only.

</domain>

<decisions>
## Implementation Decisions

### Role Resolution
- **D-01:** Highest-wins priority: admin > owner > editor > viewer. If a user qualifies for multiple roles, they get the highest.
- **D-02:** Role resolution happens inside `getAuthorizedProject` — extend the existing function rather than creating a new one.
- **D-03:** ProjectShare lookup is joined with the project fetch in a single Prisma query (one round-trip). Include ProjectShare records filtered by the current user's User.id.
- **D-04:** Role resolution must handle the email-to-User.id bridge: Project.userId is an email string, ProjectShare.userId is a User.id (cuid). The function must look up the User record by email to check shares.

### Viewer Enforcement
- **D-05:** Each server action that performs a mutation checks the resolved role and returns `{ success: false, error: "Read-only access" }` if the user is a viewer. Matches the existing error response pattern.
- **D-06:** No 404 for viewer mutation attempts — the user already has legitimate read access. Error object is the right response.
- **D-07:** Phase 31 is server-side enforcement only. UI control disabling for viewers is deferred to Phase 33 (Projects Page Integration), which will consume the role info returned by authorization functions.

### Inline Check Consolidation
- **D-08:** Add route-specific auth helpers to `lib/auth/authorization.ts`: `getAuthorizedRun`, `getAuthorizedUpload`, and similar for entities that API routes currently check inline.
- **D-09:** Each helper resolves the parent project, checks access via the same role resolution logic, and returns the entity + role. API routes replace inline checks with one-liner calls.
- **D-10:** All ~6 API route handlers with inline ownership checks must be migrated to use centralized helpers. No inline `project.userId !== user.email` checks should remain outside the authorization module.

### Auth Return Shape
- **D-11:** `getAuthorizedProject` returns `{ project, user, role: 'owner' | 'editor' | 'viewer' | 'admin', canEdit: boolean, isAdmin: boolean }`. Role is the source of truth; `canEdit` is a convenience flag (true for owner, editor, admin).
- **D-12:** `getAuthorizedProjects` (list view) also returns per-project roles, so downstream phases can show role badges on project cards without additional queries.
- **D-13:** Route-specific helpers (getAuthorizedRun, etc.) return the same shape plus the resolved entity.

### Claude's Discretion
- Exact Prisma include/select shape for the joined ProjectShare query
- Whether to create a shared `AuthResult` TypeScript type or keep return types inline
- How to handle the User.id lookup efficiently (cache per request, or query each time)
- Whether `getAuthorizedProjects` uses a single query with joins or two queries (owned + shared) merged
- Test strategy: unit tests for role resolution logic, integration tests for API route migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authorization Module
- `lib/auth/authorization.ts` — Current centralized module (getAuthorizedProject, getAuthorizedProjects, isAdmin). This is the primary file being refactored.
- `lib/auth/index.ts` — getCurrentUser helper (session-based, redirects if not authenticated)
- `lib/auth/types.ts` — UserInfo interface (sub, email, name, groups) and SessionData
- `lib/auth/__tests__/authorization.test.ts` — Existing authorization tests

### API Routes with Inline Auth (must consolidate)
- `app/api/runs/[id]/route.ts` — Inline ownership check on run progress polling
- `app/api/uploads/route.ts` — Inline ownership check on upload POST and GET
- `app/api/runs/[id]/subtask-progress/route.ts` — Inline check
- `app/api/runs/[id]/batch-story/route.ts` — Inline check
- `app/api/projects/[id]/active-batch-story-run/route.ts` — Inline check
- `app/api/projects/[id]/active-run/route.ts` — Inline check
- `app/api/projects/[id]/active-subtask-run/route.ts` — Inline check

### Server Actions (already centralized, need viewer guards)
- `server/actions/projects.ts` — Project CRUD
- `server/actions/uploads.ts` — File uploads (mutation)
- `server/actions/analysis.ts` — Card analysis runs (mutation)
- `server/actions/generation.ts` — Epic generation (mutation)
- `server/actions/batch-stories.ts` — Batch story generation (mutation)
- `server/actions/subtasks.ts` — Subtask generation (mutation)
- `server/actions/epics.ts` — Epic operations
- `server/actions/jira-export.ts` — JIRA export (mutation)
- `server/actions/export.ts` — General export (mutation)
- `server/actions/mss.ts` — MSS operations (mutation)
- `server/actions/questions.ts` — AI question operations

### Data Model
- `prisma/schema.prisma` — User, ProjectShare, Project models and their relationships
- `.planning/phases/30-data-foundation/30-CONTEXT.md` — Phase 30 decisions (User.id is cuid, ProjectShare.userId is FK to User.id, Project.userId remains email)

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 (role-based access), AUTH-02 (viewer mutation block), AUTH-03 (admin override)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/authorization.ts` — Core module being extended. Already has `getAuthorizedProject`, `getAuthorizedProjects`, `isAdmin`, `ADMIN_EMAIL`
- `lib/auth/index.ts` — `getCurrentUser()` returns `UserInfo` with email, name, groups
- `lib/db.ts` — Prisma client instance used throughout
- `lib/auth/__tests__/authorization.test.ts` — Existing test patterns for authorization

### Established Patterns
- **Server action error pattern:** `{ success: false, error: "message" }` — viewer mutation rejection should follow this
- **404-not-403:** `notFound()` for unauthorized access to prevent leaking project existence — preserved for users with NO access, but viewers get error objects on mutations
- **Entity chain ownership:** Project.userId is the root ownership field; child entities (uploads, runs, epics) are authorized by resolving their parent project
- **Try-catch auth in server actions:** Many actions use `try { await getAuthorizedProject(...) } catch { return null }` pattern

### Integration Points
- `getAuthorizedProject` is called in ~50 places across 10 server action files — return shape change must be backward-compatible or all callers updated
- `getAuthorizedProjects` is called in projects page and runs page — needs to include shared projects
- API route inline checks in ~7 files — replace with centralized helpers
- ProjectShare table already exists with indexes (from Phase 30) — ready to query

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

*Phase: 31-authorization-refactor*
*Context gathered: 2026-03-23*
