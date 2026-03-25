# Phase 30: Data Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the User table and ProjectShare schema so all downstream sharing features (authorization, share management UI, projects page integration) have a data layer to work with. Includes login-time user record creation and backfill migration for existing users.

</domain>

<decisions>
## Implementation Decisions

### User Identity Model
- **D-01:** User table uses cuid as primary key (`User.id = cuid()`), with `email` as a unique constraint field
- **D-02:** `Project.userId` remains an email string in this phase — no FK change. Phase 31 can add the FK relationship when refactoring authorization
- **D-03:** User table fields: `id` (cuid), `email` (unique), `name` (nullable string), `createdAt`, `updatedAt`

### Display Name Handling
- **D-04:** When a user has no display name (backfilled users who haven't logged in again), show the full email address as fallback
- **D-05:** Display name auto-populates on next login via the upsert mechanism

### ProjectShare Schema
- **D-06:** `ProjectShare.userId` is a proper FK to `User.id` (cuid), not an email string
- **D-07:** Only users who exist in the User table can be shared with (referential integrity enforced)
- **D-08:** ProjectShare fields: `id` (cuid), `projectId` (FK to Project), `userId` (FK to User), `role` (string: "viewer" | "editor"), `createdAt`
- **D-09:** Unique constraint on `[projectId, userId]` — a user can only have one role per project

### Login Upsert
- **D-10:** User upsert happens in the auth callback (`app/api/auth/callback/`) right after token exchange succeeds
- **D-11:** Upsert uses email as the match key, updates `name` from Cognito claims on each login
- **D-12:** Single location, runs once per login — no per-request overhead

### Claude's Discretion
- Role storage: string vs Prisma enum for the role field — Claude can choose based on what works best with Prisma and downstream phases
- Migration approach for backfilling: exact SQL strategy for populating User table from existing `Project.userId` values
- Index strategy on ProjectShare (beyond the unique constraint)
- Cascade behavior on User deletion (unlikely scenario but schema should handle it)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication & Authorization
- `lib/auth/authorization.ts` — Current centralized authorization module (getAuthorizedProject, getAuthorizedProjects, isAdmin)
- `lib/auth/index.ts` — getCurrentUser helper (redirects if not authenticated)
- `lib/auth/session.ts` — iron-session configuration and getSession
- `lib/auth/types.ts` — UserInfo interface (sub, email, name, groups) and SessionData

### Data Model
- `prisma/schema.prisma` — Current schema with Project.userId as email string, all entity relationships
- `.planning/research/ARCHITECTURE.md` — Architectural design for project sharing (User table approach, backfill strategy)
- `.planning/research/STACK.md` — Stack research for sharing implementation

### Auth Flow
- `app/api/auth/callback/` — OAuth callback where User upsert will be added

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01 (User identity), DATA-02 (ProjectShare record)
- `.planning/ROADMAP.md` — Phase 30 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/authorization.ts` — Centralized auth module; Phase 31 will extend this but Phase 30 doesn't modify it
- `lib/db.ts` (Prisma client) — Standard database client used throughout
- `app/api/auth/callback/` — Auth callback where upsert will be added

### Established Patterns
- **cuid IDs everywhere** — All models use `@id @default(cuid())`
- **Cascade deletes** — Parent deletion cascades to children (Upload->Cards, Project->Uploads, etc.)
- **@@index on FKs** — All foreign keys have corresponding indexes
- **Entity chain ownership** — Project is the root entity; children don't carry userId

### Integration Points
- Auth callback: User upsert added after token exchange
- Prisma schema: New User and ProjectShare models
- Migration: Backfill User table from existing Project.userId values
- Project model: Add shares relation (ProjectShare[])

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

*Phase: 30-data-foundation*
*Context gathered: 2026-03-23*
