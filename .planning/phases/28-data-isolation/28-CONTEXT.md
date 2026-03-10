# Phase 28: Data Isolation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-user project ownership with admin bypass and existing data migration. Each authenticated user sees only their own projects. Admin user (hardcoded email) can access all projects. All existing projects are migrated to the admin user. Server actions and API routes enforce ownership at the data access layer. Does NOT include admin UI toggle (Phase 29), user menu (Phase 29), or Okta group-based admin detection (future phase).

</domain>

<decisions>
## Implementation Decisions

### Admin role detection
- Admin determined by hardcoded email constant, NOT Okta group membership
- Single `ADMIN_EMAIL = "sean.mcinerney@merkle.com"` constant in `lib/auth/`
- Group-based admin detection (ADMIN-01) deferred to a future phase
- Admin sees a subtle "Owner: user@email" badge on projects that aren't theirs

### Ownership enforcement pattern
- Centralized `getAuthorizedProject(id)` helper function that calls `getCurrentUser()`, checks ownership (or admin), and throws `notFound()` if denied
- All server actions call this helper instead of raw `db.project.findUnique`
- Ownership enforced at project level only — child entities (uploads, cards, epics, stories, subtasks) inherit access from their parent project
- No userId column needed on Upload, Card, Epic, or other child tables
- `getProjects()` auto-filters by current user's email; admin gets all projects
- `/runs` page filtered to only show runs belonging to the user's projects

### Data migration
- Prisma SQL migration backfills `userId = 'sean.mcinerney@merkle.com'` for all existing rows where `userId IS NULL`
- After backfill, schema changes `userId` from `String?` to `String` (non-nullable, required)
- Migration runs automatically on deploy via entrypoint.js (existing `npx prisma migrate deploy` flow)
- `userId` stores the user's email address (not Cognito sub UUID) — human-readable, stable for corporate Okta users

### Access denied behavior
- Unauthorized project access returns 404 Not Found (not 403) — does not leak existence of other users' projects
- Page routes: `notFound()` renders the Next.js 404 page
- Server actions: return `{ success: false, error: "Project not found" }`
- No redirect — clean 404 treatment throughout

### Claude's Discretion
- Exact implementation of the `getAuthorizedProject()` helper (error handling, caching)
- Whether to create a separate `lib/auth/admin.ts` or extend `lib/auth/index.ts`
- How to structure the Prisma migration SQL (single migration or split)
- Test strategy for ownership enforcement
- How to handle edge cases in createProject (auto-assign userId from session)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/index.ts`: `getCurrentUser()` returns `UserInfo { sub, email, name, groups }` — use `email` as userId
- `lib/auth/types.ts`: `UserInfo` and `SessionData` types already defined
- `prisma/schema.prisma`: `Project.userId` column exists as `String?` with `@@index([userId])` — ready for migration
- `server/actions/projects.ts`: `getProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deleteProject()` — all need userId filtering

### Established Patterns
- Server actions in `server/actions/` use `"use server"` directive with Prisma queries
- Structured error returns: `{ success: boolean, data?: T, error?: string }`
- `revalidatePath()` after mutations for cache invalidation
- `entrypoint.js` runs `npx prisma migrate deploy` on container start — migrations auto-apply

### Integration Points
- 12 server action files need ownership checks: `projects.ts`, `analysis.ts`, `generation.ts`, `batch-stories.ts`, `uploads.ts`, `epics.ts`, `subtasks.ts`, `export.ts`, `jira-export.ts`, `mss.ts`, `questions.ts`
- 6+ API routes in `app/api/` that operate on project data need ownership verification
- `app/projects/[id]/page.tsx` — project detail page needs ownership gate
- `app/runs/page.tsx` — runs list needs user-scoped filtering
- `createProject()` must auto-assign `userId` from `getCurrentUser().email`

</code_context>

<specifics>
## Specific Ideas

- Admin badge: subtle "Owner: user@email" label on projects belonging to other users when admin views them — helps admin know whose data they're seeing
- Email as userId: human-readable in database, matches admin constant, stable for corporate SSO users

</specifics>

<deferred>
## Deferred Ideas

- Okta group-based admin detection (ADMIN-01) — move to a future phase; use hardcoded email for now
- Admin project reassignment between users (ADMIN-04) — v2 requirement
- Audit log of user actions (ADMIN-06) — v2 requirement

</deferred>

---

*Phase: 28-data-isolation*
*Context gathered: 2026-03-10*
