# Phase 28: Data Isolation - Research

**Researched:** 2026-03-10
**Domain:** Multi-tenant data isolation via application-level ownership enforcement (Next.js + Prisma + PostgreSQL)
**Confidence:** HIGH

## Summary

This phase adds per-user data isolation to an existing Next.js application that already has working Okta SSO authentication (Phase 27). The core work is: (1) a Prisma SQL migration to backfill existing projects with the admin email and make `userId` non-nullable, (2) a centralized `getAuthorizedProject()` helper that enforces ownership-or-admin checks, and (3) systematic modification of ~12 server action files, ~6 API routes, and 2 page components to use the new ownership-aware data access layer.

The architecture is straightforward -- application-level filtering using the authenticated user's email from `getCurrentUser()`. No PostgreSQL Row-Level Security (explicitly out of scope per REQUIREMENTS.md). No new libraries needed. The risk is primarily in completeness: missing a single server action or API route would leave a data leak.

**Primary recommendation:** Create a centralized `lib/auth/authorization.ts` module with `getAuthorizedProject()`, `getAuthorizedProjects()`, and `isAdmin()` helpers. All data access goes through these helpers. Every server action and API route that touches project data must be audited and updated.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Admin determined by hardcoded email constant, NOT Okta group membership
- Single `ADMIN_EMAIL = "sean.mcinerney@merkle.com"` constant in `lib/auth/`
- Group-based admin detection (ADMIN-01) deferred to a future phase
- Admin sees a subtle "Owner: user@email" badge on projects that aren't theirs
- Centralized `getAuthorizedProject(id)` helper function that calls `getCurrentUser()`, checks ownership (or admin), and throws `notFound()` if denied
- All server actions call this helper instead of raw `db.project.findUnique`
- Ownership enforced at project level only -- child entities inherit access from their parent project
- No userId column needed on Upload, Card, Epic, or other child tables
- `getProjects()` auto-filters by current user's email; admin gets all projects
- `/runs` page filtered to only show runs belonging to the user's projects
- Prisma SQL migration backfills `userId = 'sean.mcinerney@merkle.com'` for all existing rows where `userId IS NULL`
- After backfill, schema changes `userId` from `String?` to `String` (non-nullable, required)
- Migration runs automatically on deploy via entrypoint.js
- `userId` stores the user's email address (not Cognito sub UUID)
- Unauthorized project access returns 404 Not Found (not 403) -- does not leak existence
- Page routes: `notFound()` renders the Next.js 404 page
- Server actions: return `{ success: false, error: "Project not found" }`

### Claude's Discretion
- Exact implementation of the `getAuthorizedProject()` helper (error handling, caching)
- Whether to create a separate `lib/auth/admin.ts` or extend `lib/auth/index.ts`
- How to structure the Prisma migration SQL (single migration or split)
- Test strategy for ownership enforcement
- How to handle edge cases in createProject (auto-assign userId from session)

### Deferred Ideas (OUT OF SCOPE)
- Okta group-based admin detection (ADMIN-01) -- move to a future phase; use hardcoded email for now
- Admin project reassignment between users (ADMIN-04) -- v2 requirement
- Audit log of user actions (ADMIN-06) -- v2 requirement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | New projects are automatically assigned to the authenticated user | `createProject()` must call `getCurrentUser()` and set `userId: user.email` |
| DATA-02 | Users see only their own projects in all views | `getProjects()` filters by `userId`, runs page joins through project.userId |
| DATA-03 | All server actions and API routes enforce userId ownership checks | Centralized `getAuthorizedProject()` helper; 12 server action files + 6 API routes need updates |
| DATA-04 | Existing projects are migrated to the admin user during deployment | Prisma SQL migration: backfill NULL userId, then make column non-nullable |
| ADMIN-01 | Users in Okta admin group are granted admin role via JWT claims | DEFERRED per user decision -- using hardcoded email constant instead for now |
| ADMIN-03 | Default admin is sean.mcinerney@merkle.com | Hardcoded `ADMIN_EMAIL` constant in authorization module |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing) | ORM, migrations, schema | Already in project; SQL migrations for data backfill |
| Next.js | (existing) | Server actions, API routes, `notFound()` | Already in project; `notFound()` is the standard 404 pattern |
| iron-session | (existing) | Session management | Already provides `getCurrentUser()` with email |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | (built-in) | `notFound()`, `redirect()` | For 404 responses in page/server-action context |
| server-only | (existing) | Ensure auth helpers never run on client | Already used in `lib/auth/index.ts` |

### Alternatives Considered
No new libraries needed. All required functionality is available in the existing stack.

## Architecture Patterns

### Recommended Project Structure
```
lib/auth/
  index.ts          # getCurrentUser() -- already exists
  types.ts          # UserInfo, SessionData -- already exists
  session.ts        # getSession() -- already exists
  authorization.ts  # NEW: getAuthorizedProject(), getAuthorizedProjects(), isAdmin(), ADMIN_EMAIL
```

### Pattern 1: Centralized Authorization Helper
**What:** A single module (`lib/auth/authorization.ts`) that all server actions and API routes call to verify project ownership.
**When to use:** Every time a server action or API route accesses a project by ID.
**Example:**
```typescript
// lib/auth/authorization.ts
import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./index";
import { db } from "@/lib/db";

export const ADMIN_EMAIL = "sean.mcinerney@merkle.com";

export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

/**
 * Get a project by ID with ownership verification.
 * Returns the project if the current user owns it or is admin.
 * Calls notFound() if unauthorized (returns 404, not 403).
 */
export async function getAuthorizedProject(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    notFound();
  }

  if (project.userId !== user.email && !isAdmin(user.email)) {
    notFound(); // 404, not 403 -- don't leak existence
  }

  return { project, user, isAdmin: isAdmin(user.email) };
}

/**
 * Get all projects for the current user (or all projects for admin).
 */
export async function getAuthorizedProjects() {
  const user = await getCurrentUser();
  const where = isAdmin(user.email) ? {} : { userId: user.email };

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { uploads: true, cards: true, epics: true, runs: true },
      },
    },
  });

  return { projects, user, isAdmin: isAdmin(user.email) };
}
```

### Pattern 2: Server Action Ownership Check (for actions receiving projectId)
**What:** Server actions that receive a `projectId` parameter call `getAuthorizedProject()` before performing any database operation.
**When to use:** Every mutation (create upload, analyze, generate, export) that operates on a project.
**Example:**
```typescript
// In server/actions/analysis.ts
export async function analyzeProject(input: AnalyzeProjectInput) {
  const { projectId, uploadIds, options = {} } = input;

  // Ownership check -- throws notFound() if unauthorized
  const { project } = await getAuthorizedProject(projectId);

  // ... rest of the function uses project instead of raw db.project.findUnique
}
```

### Pattern 3: API Route Ownership Check
**What:** API routes that receive projectId in URL params or query params verify ownership before processing.
**When to use:** All API routes under `/api/projects/[id]/` and `/api/uploads`, `/api/runs/[id]`.
**Example:**
```typescript
// In API routes -- can't use notFound(), return JSON 404 instead
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAIL, isAdmin } from "@/lib/auth/authorization";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project || (project.userId !== user.email && !isAdmin(user.email))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  // ... continue
}
```

**Note on API routes vs server actions:** The `notFound()` function from `next/navigation` works in server components and server actions but throws in API route handlers. API routes must return `NextResponse.json()` with 404 status instead.

### Pattern 4: Runs Page Scoped Query
**What:** The runs page currently queries all runs. It needs to filter by the user's projects.
**When to use:** `/runs` page and any cross-project listing.
**Example:**
```typescript
// In runs page or a new server action
const user = await getCurrentUser();
const where = isAdmin(user.email)
  ? {}
  : { project: { userId: user.email } };

const runs = await db.run.findMany({
  where,
  orderBy: { createdAt: "desc" },
  take: 50,
  include: { project: true },
});
```

### Pattern 5: Prisma Two-Step Migration
**What:** A single Prisma migration that (a) backfills NULL userId values, then (b) makes the column non-nullable.
**When to use:** The data migration for existing projects.
**Example:**
```sql
-- Migration: add_user_ownership
-- Step 1: Backfill all existing projects with admin email
UPDATE "Project" SET "userId" = 'sean.mcinerney@merkle.com' WHERE "userId" IS NULL;

-- Step 2: Make userId required (non-nullable)
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;

-- Step 3: Set default for new rows (Prisma will enforce via app code, but belt-and-suspenders)
ALTER TABLE "Project" ALTER COLUMN "userId" SET DEFAULT '';
```
**Note:** Step 3 (default) is optional. Prisma enforces required fields at the application level. The empty-string default is a safety net that prevents DB-level INSERT failures if something bypasses Prisma. Alternatively, omit it and rely on Prisma's required field validation.

### Anti-Patterns to Avoid
- **Checking ownership in each server action independently:** Leads to inconsistent checks, copy-paste errors. Use the centralized helper.
- **Using 403 Forbidden for unauthorized access:** Leaks the existence of other users' projects. Use 404 consistently.
- **Storing Cognito `sub` as userId:** UUIDs are opaque; email is human-readable, stable for corporate SSO, and matches the admin constant.
- **Adding userId to child tables (Upload, Card, Epic):** Unnecessary complexity. Child entities inherit ownership from their parent Project via foreign key.
- **Forgetting API routes:** Server actions are obvious targets but API routes (`/api/projects/[id]/*`, `/api/uploads`, `/api/runs/[id]`) are equally important.
- **Using `notFound()` in API route handlers:** It throws an error in route handlers. Use `NextResponse.json({ error: "..." }, { status: 404 })` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session/user retrieval | Custom cookie parsing | `getCurrentUser()` from `lib/auth` | Already built in Phase 27, handles refresh |
| 404 responses | Custom error pages | `notFound()` from `next/navigation` | Standard Next.js pattern, renders `not-found.tsx` |
| Migration execution | Manual SQL scripts | Prisma `migrate deploy` via entrypoint.js | Already automated in deployment pipeline |
| Admin detection | Database roles table | Hardcoded email constant | Per user decision; Okta groups deferred |

## Common Pitfalls

### Pitfall 1: Missing an Endpoint
**What goes wrong:** One server action or API route is missed during the audit, leaving a data leak where users can access other users' data.
**Why it happens:** There are 12 server action files and 6+ API routes. Easy to miss one.
**How to avoid:** Create a comprehensive checklist. Every file in `server/actions/` must be reviewed. Every route in `app/api/` that references `projectId` must be updated.
**Warning signs:** Any `db.project.findUnique` call that doesn't go through `getAuthorizedProject()`. Grep for `db.project.find` and `db.run.find` to ensure all are covered.

### Pitfall 2: notFound() in API Route Handlers
**What goes wrong:** Using `notFound()` from `next/navigation` inside a `GET`/`POST` route handler causes an unhandled error instead of a clean 404 JSON response.
**Why it happens:** `notFound()` works by throwing a special Next.js error that's caught by the page rendering pipeline, not by API route handlers.
**How to avoid:** In server actions, use `notFound()`. In API route handlers, use `return NextResponse.json({ error: "..." }, { status: 404 })`.
**Warning signs:** 500 errors in API routes that should be returning 404.

### Pitfall 3: Migration Order Matters
**What goes wrong:** Making the column non-nullable BEFORE backfilling causes the migration to fail if any NULL rows exist.
**Why it happens:** PostgreSQL enforces NOT NULL constraints immediately on ALTER TABLE.
**How to avoid:** Always backfill first (UPDATE ... SET ... WHERE IS NULL), then ALTER COLUMN SET NOT NULL. Both in the same migration file.
**Warning signs:** Migration failure on deploy with "column contains null values" error.

### Pitfall 4: createProject Forgetting userId
**What goes wrong:** New projects created without `userId` fail because the column is now non-nullable.
**Why it happens:** The existing `createProject()` doesn't set `userId` since the column was optional.
**How to avoid:** `createProject()` must call `getCurrentUser()` and set `userId: user.email` in the create data.
**Warning signs:** Database error on project creation after migration.

### Pitfall 5: Runs Page Direct DB Access
**What goes wrong:** The runs page (`app/(authenticated)/runs/page.tsx`) currently queries `db.run.findMany` directly (not through a server action), bypassing ownership checks.
**Why it happens:** It was built before data isolation existed.
**How to avoid:** Move the query to a server action (e.g., `getAuthorizedRuns()`) or inline the ownership filter with `getCurrentUser()`.
**Warning signs:** A user can see all runs across all projects on the runs page.

### Pitfall 6: API Routes that Receive projectId via Query String
**What goes wrong:** The `/api/uploads` GET handler receives `projectId` via query string. Need to verify the user owns that project before returning uploads.
**Why it happens:** API routes don't have the same "natural" ownership check that page routes do.
**How to avoid:** For every API route that accepts a projectId (URL param or query param), verify ownership before returning data.
**Warning signs:** Uploads from another user's project are accessible via `/api/uploads?projectId=...`.

## Code Examples

### Complete Authorization Module
```typescript
// lib/auth/authorization.ts
import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./index";
import { db } from "@/lib/db";

export const ADMIN_EMAIL = "sean.mcinerney@merkle.com";

export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

export async function getAuthorizedProject(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    notFound();
  }

  if (project.userId !== user.email && !isAdmin(user.email)) {
    notFound();
  }

  return { project, user, isAdmin: isAdmin(user.email) };
}

export async function getAuthorizedProjects() {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);
  const where = admin ? {} : { userId: user.email };

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { uploads: true, cards: true, epics: true, runs: true },
      },
    },
  });

  return { projects, user, isAdmin: admin };
}
```

### Updated createProject
```typescript
export async function createProject(data: { name: string; description?: string }) {
  const user = await getCurrentUser();
  const project = await db.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      userId: user.email,
    },
  });
  revalidatePath("/projects");
  return project;
}
```

### Prisma Schema Change
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  userId      String   // Changed from String? to String (required)

  uploads Upload[]
  cards   Card[]
  epics   Epic[]
  runs    Run[]

  @@index([userId])
  @@index([createdAt])
}
```

### Migration SQL
```sql
-- Backfill existing projects
UPDATE "Project" SET "userId" = 'sean.mcinerney@merkle.com' WHERE "userId" IS NULL;

-- Make column non-nullable
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
```

## Comprehensive Audit: Files Requiring Changes

### Server Action Files (12 files in `server/actions/`)

| File | Functions Needing Ownership Check | Change Type |
|------|----------------------------------|-------------|
| `projects.ts` | `getProjects()`, `getProject()`, `getProjectName()`, `createProject()`, `updateProject()`, `deleteProject()` | Filter by userId, add ownership check, set userId on create |
| `analysis.ts` | `analyzeProject()`, `getActiveRunForProject()`, `getRunProgress()` | Add `getAuthorizedProject()` check before DB access |
| `generation.ts` | `generateEpicsForProject()`, and any story/subtask generation | Add ownership check |
| `batch-stories.ts` | Batch story generation functions | Add ownership check |
| `uploads.ts` | `createUploadFromText()` and similar | Add ownership check on projectId |
| `epics.ts` | Epic CRUD functions | Add ownership check (project-level) |
| `subtasks.ts` | Subtask generation functions | Add ownership check (via project chain) |
| `export.ts` | Export functions | Add ownership check |
| `jira-export.ts` | Jira export functions | Add ownership check |
| `mss.ts` | MSS-related functions | Check if they operate on project data (may not need changes if MSS is global) |
| `questions.ts` | AI question functions | Add ownership check if project-scoped |

### API Routes (6+ routes)

| Route | Method | Change |
|-------|--------|--------|
| `/api/projects/[id]/active-run` | GET | Verify ownership of project `[id]` |
| `/api/projects/[id]/active-batch-story-run` | GET | Verify ownership of project `[id]` |
| `/api/projects/[id]/active-subtask-run` | GET | Verify ownership of project `[id]` |
| `/api/uploads` | POST | Verify ownership of `projectId` from form data |
| `/api/uploads` | GET | Verify ownership of `projectId` from query string |
| `/api/runs/[id]` | GET | Verify run belongs to user's project (join through run.project.userId) |
| `/api/runs/[id]/batch-story` | GET | Verify run belongs to user's project |
| `/api/runs/[id]/subtask-progress` | GET | Verify run belongs to user's project |
| `/api/cron/recover-stale-runs` | GET | System route -- may need special handling (no user session) |

### Page Components

| Page | Change |
|------|--------|
| `app/(authenticated)/projects/page.tsx` | Use `getAuthorizedProjects()` instead of `getProjects()` |
| `app/(authenticated)/projects/[id]/page.tsx` | Already calls `getProject()` then `notFound()` -- needs ownership gate via updated `getProject()` |
| `app/(authenticated)/runs/page.tsx` | Filter runs by user's projects |
| `app/(authenticated)/runs/[id]/page.tsx` | Verify run belongs to user's project |

### Special Cases

- **`/api/cron/recover-stale-runs`**: This is a system/cron route, likely called without a user session. It should continue to operate on all runs (system-level concern, not user-scoped).
- **`/api/health`**: No change needed -- no project data.
- **`/api/auth/*`**: No change needed -- authentication routes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostgreSQL RLS for tenant isolation | App-level filtering (for Prisma apps) | Ongoing | Prisma doesn't support RLS session variables natively; app-level is the standard pattern |
| Middleware-only auth | Defense-in-depth (middleware + server-side checks) | CVE-2025-29927 | Server actions must independently verify auth, not rely on middleware |

## Open Questions

1. **Cron route session handling**
   - What we know: `/api/cron/recover-stale-runs` is called without a user session
   - What's unclear: Whether it needs any changes for data isolation
   - Recommendation: Leave it as-is (system-level operation). Document that it intentionally bypasses ownership checks.

2. **Admin badge on project list**
   - What we know: Admin should see "Owner: user@email" on projects that aren't theirs
   - What's unclear: Exact UI placement and styling
   - Recommendation: Small muted-foreground text or badge under project name. `getAuthorizedProjects()` returns `isAdmin` flag and projects include `userId` field for comparison.

3. **Run ownership for API polling routes**
   - What we know: Runs belong to projects; client polls `/api/runs/[id]` for progress
   - What's unclear: Whether to verify run ownership by joining through project, or to trust that the client only has run IDs from authorized projects
   - Recommendation: Always verify. Join `run -> project -> userId` to confirm ownership. Defense-in-depth.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing config) |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | createProject assigns userId from session | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "createProject"` | No -- Wave 0 |
| DATA-02 | getAuthorizedProjects filters by user | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProjects"` | No -- Wave 0 |
| DATA-03 | getAuthorizedProject rejects non-owner | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProject"` | No -- Wave 0 |
| DATA-04 | Migration backfills NULL userId | manual-only | Verify via `prisma migrate deploy` on test DB | N/A |
| ADMIN-01 | Deferred (hardcoded email) | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "isAdmin"` | No -- Wave 0 |
| ADMIN-03 | ADMIN_EMAIL constant = sean.mcinerney@merkle.com | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "ADMIN_EMAIL"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/auth/__tests__/authorization.test.ts` -- unit tests for isAdmin, getAuthorizedProject, getAuthorizedProjects
- [ ] Mock setup for `getCurrentUser()` and `db` (Prisma mock or vi.mock)
- [ ] Note: DATA-04 (migration) is manual-only -- verify by checking DB state after migration

## Sources

### Primary (HIGH confidence)
- Project codebase: `lib/auth/index.ts`, `lib/auth/types.ts`, `server/actions/projects.ts` -- direct code review
- Project codebase: `prisma/schema.prisma` -- current schema with `userId String?` and `@@index([userId])`
- Project codebase: `entrypoint.js` -- confirms `prisma migrate deploy` runs on container start
- Project codebase: All 12 server action files and 11 API route files audited

### Secondary (MEDIUM confidence)
- Next.js `notFound()` behavior in API routes vs server components -- based on framework knowledge; well-documented behavior
- Prisma migration SQL ordering (backfill before NOT NULL) -- standard PostgreSQL migration practice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing tooling
- Architecture: HIGH - centralized authorization helper is a well-established pattern; codebase fully audited
- Pitfalls: HIGH - all identified from direct code review of the actual codebase
- Migration: HIGH - straightforward SQL backfill + ALTER TABLE pattern

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies changing)
