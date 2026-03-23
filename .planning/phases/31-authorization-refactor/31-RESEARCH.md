# Phase 31: Authorization Refactor - Research

**Researched:** 2026-03-23
**Domain:** Server-side authorization (role resolution, viewer enforcement, inline check consolidation)
**Confidence:** HIGH

## Summary

Phase 31 extends the existing centralized authorization module (`lib/auth/authorization.ts`) to resolve explicit roles from ProjectShare records, enforce viewer mutation restrictions, and consolidate 7 API routes that currently perform inline ownership checks. The data foundation (User table, ProjectShare table with indexes) is already in place from Phase 30.

The core challenge is the email-to-User.id bridge: `Project.userId` stores an email string, while `ProjectShare.userId` is a FK to `User.id` (cuid). Role resolution must look up the User record by email to find applicable shares. The existing `getAuthorizedProject` function is called in ~50 places across 11 server action files, so the return shape change must be carefully managed to avoid breakage.

**Primary recommendation:** Extend `getAuthorizedProject` to join ProjectShare in a single Prisma query (via User email lookup), resolve the highest role, and return an enriched result with `role`, `canEdit`, and `isAdmin` fields. Add `getAuthorizedRun` and `getAuthorizedUpload` helpers for API route consolidation. Add viewer guards to all mutation server actions using a utility that checks the resolved role.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Highest-wins priority: admin > owner > editor > viewer. If a user qualifies for multiple roles, they get the highest.
- **D-02:** Role resolution happens inside `getAuthorizedProject` -- extend the existing function rather than creating a new one.
- **D-03:** ProjectShare lookup is joined with the project fetch in a single Prisma query (one round-trip). Include ProjectShare records filtered by the current user's User.id.
- **D-04:** Role resolution must handle the email-to-User.id bridge: Project.userId is an email string, ProjectShare.userId is a User.id (cuid). The function must look up the User record by email to check shares.
- **D-05:** Each server action that performs a mutation checks the resolved role and returns `{ success: false, error: "Read-only access" }` if the user is a viewer. Matches the existing error response pattern.
- **D-06:** No 404 for viewer mutation attempts -- the user already has legitimate read access. Error object is the right response.
- **D-07:** Phase 31 is server-side enforcement only. UI control disabling for viewers is deferred to Phase 33.
- **D-08:** Add route-specific auth helpers to `lib/auth/authorization.ts`: `getAuthorizedRun`, `getAuthorizedUpload`, and similar for entities that API routes currently check inline.
- **D-09:** Each helper resolves the parent project, checks access via the same role resolution logic, and returns the entity + role. API routes replace inline checks with one-liner calls.
- **D-10:** All ~6 API route handlers with inline ownership checks must be migrated to use centralized helpers. No inline `project.userId !== user.email` checks should remain outside the authorization module.
- **D-11:** `getAuthorizedProject` returns `{ project, user, role: 'owner' | 'editor' | 'viewer' | 'admin', canEdit: boolean, isAdmin: boolean }`. Role is the source of truth; `canEdit` is a convenience flag (true for owner, editor, admin).
- **D-12:** `getAuthorizedProjects` (list view) also returns per-project roles, so downstream phases can show role badges on project cards without additional queries.
- **D-13:** Route-specific helpers (getAuthorizedRun, etc.) return the same shape plus the resolved entity.

### Claude's Discretion
- Exact Prisma include/select shape for the joined ProjectShare query
- Whether to create a shared `AuthResult` TypeScript type or keep return types inline
- How to handle the User.id lookup efficiently (cache per request, or query each time)
- Whether `getAuthorizedProjects` uses a single query with joins or two queries (owned + shared) merged
- Test strategy: unit tests for role resolution logic, integration tests for API route migration

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can access shared projects based on their effective role (owner/editor/viewer/admin) | Role resolution in `getAuthorizedProject` with ProjectShare join; `getAuthorizedProjects` includes shared projects |
| AUTH-02 | User with viewer role cannot trigger mutations (uploads, AI runs, edits, deletions, exports) | Viewer guard utility checked in all mutation server actions; returns `{ success: false, error: "Read-only access" }` |
| AUTH-03 | Admin can still access all projects regardless of sharing | Existing `isAdmin()` check preserved; admin role takes highest priority in resolution |
</phase_requirements>

## Architecture Patterns

### Current Authorization Flow (Before Phase 31)
```
User request -> getCurrentUser() -> getAuthorizedProject(id) -> check project.userId === user.email || isAdmin -> return { project, user, isAdmin }
```

### Target Authorization Flow (After Phase 31)
```
User request -> getCurrentUser() -> getAuthorizedProject(id) -> fetch project + User record + ProjectShares in one query -> resolve role (admin > owner > editor > viewer > none) -> none? notFound() -> return { project, user, role, canEdit, isAdmin }
```

### Recommended Type Definitions

Create a shared `AuthResult` type in `lib/auth/authorization.ts`:

```typescript
export type ProjectRole = 'admin' | 'owner' | 'editor' | 'viewer';

export interface AuthResult {
  project: Project;
  user: UserInfo;
  role: ProjectRole;
  canEdit: boolean;
  isAdmin: boolean;
}

export interface AuthResultWithEntity<T> extends AuthResult {
  entity: T;
}
```

**Rationale:** A shared type is preferable because the same shape is returned by `getAuthorizedProject`, `getAuthorizedRun`, `getAuthorizedUpload`, etc. Inline types would duplicate the role/canEdit/isAdmin fields across each helper.

### Pattern 1: Role Resolution (Inside getAuthorizedProject)

**What:** Single Prisma query fetches project + ProjectShare records for the current user, then resolves the highest applicable role.

**When to use:** Every time `getAuthorizedProject` is called (which is ~50 call sites).

```typescript
export async function getAuthorizedProject(projectId: string): Promise<AuthResult> {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  // Look up User record by email to get User.id for share lookup
  const dbUser = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      shares: dbUser ? {
        where: { userId: dbUser.id },
        select: { role: true },
      } : undefined,
    },
  });

  if (!project) {
    notFound();
  }

  // Resolve role: admin > owner > editor > viewer > none
  const role = resolveRole({
    isAdmin: admin,
    isOwner: project.userId === user.email,
    shareRole: project.shares?.[0]?.role as 'editor' | 'viewer' | undefined,
  });

  if (!role) {
    notFound(); // No access at all -> 404
  }

  return {
    project,
    user,
    role,
    canEdit: role !== 'viewer',
    isAdmin: admin,
  };
}
```

**Note on D-03 (single round-trip):** The above uses two queries (User lookup + Project with shares). To achieve a true single round-trip, use `db.$transaction` or restructure. However, the User.id lookup is a simple indexed query on a unique field. The practical recommendation is:

1. **Option A (two queries, simpler):** `db.user.findUnique` + `db.project.findUnique` with include. Two indexed lookups, sub-millisecond each.
2. **Option B (single raw query):** Use `db.$queryRaw` to join User, Project, and ProjectShare in one SQL query. More complex but truly one round-trip.
3. **Option C (single Prisma query with nested filter):** Not directly possible since Project and User are not directly related.

**Recommendation:** Option A is the pragmatic choice. The User.email lookup is a unique index hit (sub-ms). The spirit of D-03 is to avoid N+1 queries or separate ProjectShare lookups; two simple indexed queries satisfies this intent.

### Pattern 2: Role Resolution Pure Function

**What:** A pure function that takes capability flags and returns the highest role.

```typescript
function resolveRole(params: {
  isAdmin: boolean;
  isOwner: boolean;
  shareRole?: 'editor' | 'viewer';
}): ProjectRole | null {
  if (params.isAdmin) return 'admin';
  if (params.isOwner) return 'owner';
  if (params.shareRole === 'editor') return 'editor';
  if (params.shareRole === 'viewer') return 'viewer';
  return null; // No access
}
```

**Why pure:** Easily unit-testable without mocking Prisma or next/navigation. The core business logic (D-01 highest-wins) is isolated.

### Pattern 3: Viewer Guard Utility

**What:** A utility function that server actions call after authorization to block viewer mutations.

```typescript
export function assertCanEdit(authResult: AuthResult): void {
  // Does not throw -- server actions use this pattern:
  // Caller checks and returns error object
}

// Alternative: returns the error object for server actions to return
export function checkCanEdit(role: ProjectRole): { allowed: true } | { allowed: false; error: string } {
  if (role === 'viewer') {
    return { allowed: false, error: 'Read-only access' };
  }
  return { allowed: true };
}
```

**Usage in server actions (matching existing try-catch pattern):**
```typescript
export async function generateEpicsForProject(projectId: string) {
  const auth = await getAuthorizedProject(projectId);
  // getAuthorizedProject already calls notFound() if no access at all
  if (!auth.canEdit) {
    return { success: false, error: "Read-only access" };
  }
  // ... proceed with mutation
}
```

**Note:** Many server actions currently use `try { await getAuthorizedProject(id); } catch { return ... }` to handle the notFound() throw. The refactored version must preserve this pattern. Since `getAuthorizedProject` still calls `notFound()` for NO access, the try-catch remains valid. The viewer check is a separate, non-throwing check after authorization succeeds.

### Pattern 4: Route-Specific Auth Helpers

**What:** Helpers like `getAuthorizedRun` that resolve the parent project, check access, and return the entity + role.

```typescript
export async function getAuthorizedRun(runId: string): Promise<AuthResultWithEntity<Run>> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { project: true },
  });

  if (!run) {
    notFound();
  }

  const auth = await getAuthorizedProject(run.projectId);
  return { ...auth, entity: run };
}
```

**For API routes, this replaces:**
```typescript
// BEFORE (inline in each route):
const user = await getCurrentUser();
const run = await db.run.findUnique({ where: { id }, include: { project: { select: { userId: true } } } });
if (!run || (run.project.userId !== user.email && !isAdmin(user.email))) {
  return NextResponse.json({ error: "Run not found" }, { status: 404 });
}

// AFTER (one-liner):
const { entity: run, role } = await getAuthorizedRun(id);
```

**Note:** `getAuthorizedRun` calls `notFound()` on failure, which in API routes throws and results in a 404 response from Next.js. This matches the existing 404 behavior. API routes that need to catch this and return JSON 404 should wrap in try-catch.

### Pattern 5: getAuthorizedProjects with Shared Projects

**What:** Extend `getAuthorizedProjects` to include projects shared with the user, annotated with per-project roles.

```typescript
export async function getAuthorizedProjects(viewAll: boolean = false) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  // For admin with viewAll: return everything
  if (admin && viewAll) {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { uploads: true, cards: true, epics: true, runs: true } } },
    });
    return {
      projects: projects.map(p => ({ ...p, role: 'admin' as ProjectRole })),
      user,
      isAdmin: true,
    };
  }

  // Look up User.id for share lookup
  const dbUser = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  // Two queries merged: owned projects + shared projects
  const [ownedProjects, sharedProjects] = await Promise.all([
    db.project.findMany({
      where: { userId: user.email },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { uploads: true, cards: true, epics: true, runs: true } } },
    }),
    dbUser ? db.project.findMany({
      where: {
        shares: { some: { userId: dbUser.id } },
        userId: { not: user.email }, // Exclude owned (already in first query)
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { uploads: true, cards: true, epics: true, runs: true } },
        shares: {
          where: { userId: dbUser.id },
          select: { role: true },
          take: 1,
        },
      },
    }) : [],
  ]);

  const annotatedOwned = ownedProjects.map(p => ({
    ...p,
    role: (admin ? 'admin' : 'owner') as ProjectRole,
  }));

  const annotatedShared = sharedProjects.map(p => ({
    ...p,
    role: (p.shares[0]?.role || 'viewer') as ProjectRole,
  }));

  return {
    projects: [...annotatedOwned, ...annotatedShared],
    user,
    isAdmin: admin,
  };
}
```

**Recommendation:** Two parallel queries (owned + shared) merged is the clearest approach. A single Prisma query with OR conditions is possible but harder to annotate with the correct role. The two-query approach naturally separates owned vs shared for the downstream Phase 33 UI ("My Projects" vs "Shared with me").

### Anti-Patterns to Avoid
- **Checking `project.userId` outside authorization module:** This is the exact pattern D-10 eliminates. All 7 API routes must migrate.
- **Throwing for viewer mutation rejection:** Viewers have legitimate read access. Return error objects, don't throw/notFound() (D-05, D-06).
- **Caching User.id across requests:** Each server action/API route runs in a separate request context. No request-scoped cache is needed -- the User.email -> User.id lookup is a single indexed query.
- **Breaking the return shape of getAuthorizedProject:** The current return is `{ project, user, isAdmin }`. The new return adds `role` and `canEdit`. Since no existing callers destructure to reject unknown properties, adding fields is backward-compatible. The `isAdmin` field is preserved.

## Inventory of Changes Required

### API Routes with Inline Auth (7 files, must consolidate)

| File | Entity | Current Pattern | New Pattern |
|------|--------|-----------------|-------------|
| `app/api/runs/[id]/route.ts` | Run | Manual run lookup + project.userId check | `getAuthorizedRun(id)` |
| `app/api/runs/[id]/batch-story/route.ts` | Run | Same as above | `getAuthorizedRun(id)` |
| `app/api/runs/[id]/subtask-progress/route.ts` | Run | Same as above | `getAuthorizedRun(id)` |
| `app/api/uploads/route.ts` (POST) | Project | Manual project lookup + userId check | `getAuthorizedProject(projectId)` + viewer guard |
| `app/api/uploads/route.ts` (GET) | Project | Manual project lookup + userId check | `getAuthorizedProject(projectId)` |
| `app/api/projects/[id]/active-run/route.ts` | Project | Manual project lookup + userId check | `getAuthorizedProject(id)` |
| `app/api/projects/[id]/active-batch-story-run/route.ts` | Project | Manual project lookup + userId check | `getAuthorizedProject(id)` |
| `app/api/projects/[id]/active-subtask-run/route.ts` | Project | Manual project lookup + userId check | `getAuthorizedProject(id)` |

**Note on API route notFound() behavior:** In API routes, `notFound()` from `next/navigation` throws. The current inline pattern returns `NextResponse.json({ error: "..." }, { status: 404 })`. After migration, `getAuthorizedProject` calls `notFound()` which Next.js handles as a 404 page response, not a JSON response. This difference is acceptable for polling endpoints (the client handles non-200 as error), but the planner should verify this is consistent with client expectations. Alternatively, API route helpers could catch `notFound()` throws and convert to JSON 404 responses.

### Server Actions Needing Viewer Guards

Mutation actions (need `if (!auth.canEdit) return { success: false, error: "Read-only access" }`):

| File | Functions | Type |
|------|-----------|------|
| `server/actions/uploads.ts` | `createUploadFromText`, `createUploadFromCSV`, `deleteUpload` | Mutation |
| `server/actions/analysis.ts` | `analyzeProject`, `retryRun`, `cancelRun` | Mutation |
| `server/actions/generation.ts` | `generateEpicsForProject`, `generateStoriesForEpic` | Mutation |
| `server/actions/batch-stories.ts` | `startBatchStoryGeneration`, `retryBatchStoryRun`, `cancelBatchStoryRun` | Mutation |
| `server/actions/subtasks.ts` | `generateSubtasksForEpic`, `retryBatchSubtaskRun`, `cancelBatchSubtaskRun` | Mutation |
| `server/actions/projects.ts` | `createProject` (N/A - uses getCurrentUser), `updateProject`, `deleteProject` | Mutation |
| `server/actions/jira-export.ts` | All 7 export functions | Mutation |
| `server/actions/export.ts` | `exportProject`, `exportProjectAsDocx`, `exportEpicAsDocx` | Mutation |
| `server/actions/mss.ts` | `assignMssServiceAreaToEpic`, `assignMssServiceAreaToStory` | Mutation |
| `server/actions/questions.ts` | `generateQuestionsForUpload`, `saveAnswersForUpload` | Mutation |

Read-only actions (no viewer guard needed -- viewers can read):

| File | Functions | Type |
|------|-----------|------|
| `server/actions/projects.ts` | `getProjects`, `getProjectName`, `getProject` | Read |
| `server/actions/uploads.ts` | `getUpload` | Read |
| `server/actions/epics.ts` | `getEpic`, `getEpicsForProject`, `getEpicWithStories` | Read |
| `server/actions/analysis.ts` | `getRunProgress`, `getActiveRunForProject`, `getRunHistory` | Read |
| `server/actions/batch-stories.ts` | `getBatchStoryProgress`, `getActiveBatchStoryRun`, `getBatchStoryRunHistory` | Read |
| `server/actions/subtasks.ts` | `getBatchSubtaskProgress`, `getActiveSubtaskRun`, `getBatchSubtaskRunHistory` | Read |
| `server/actions/questions.ts` | `getQuestionsForUpload` | Read |

### Authorization Module Changes (lib/auth/authorization.ts)

1. Add `ProjectRole` type and `AuthResult` interface
2. Add `resolveRole()` pure function
3. Refactor `getAuthorizedProject()` to include ProjectShare lookup and role resolution
4. Refactor `getAuthorizedProjects()` to include shared projects with per-project roles
5. Add `getAuthorizedRun()` helper
6. Add `getAuthorizedUpload()` helper (used by upload API route POST)
7. Export viewer guard utility

## Common Pitfalls

### Pitfall 1: notFound() Behavior in API Routes vs Server Actions
**What goes wrong:** `notFound()` from `next/navigation` throws an error that Next.js catches to render a 404 page. In server actions (called from React), this is fine. In API route handlers, the current code catches errors and returns JSON. After migration, if `getAuthorizedProject` is called directly in an API route, `notFound()` will produce an HTML 404 page, not a JSON 404.
**Why it happens:** Different execution contexts handle the throw differently.
**How to avoid:** In API route handlers, wrap `getAuthorizedProject` calls in try-catch and convert to JSON 404 response. Or have the route-specific helpers (`getAuthorizedRun`) handle this themselves by returning null instead of throwing.
**Warning signs:** Polling endpoints returning HTML instead of JSON to the client.

### Pitfall 2: User Record Not Found
**What goes wrong:** A user who logged in before Phase 30 deployed might not have a User record if the auth callback upsert failed or if they haven't logged in since.
**Why it happens:** User records are created via auth callback upsert (Phase 30). The migration backfilled from `SELECT DISTINCT userId FROM Project`, but users who own no projects and have no shares would have no record.
**How to avoid:** In role resolution, if `db.user.findUnique({ where: { email } })` returns null, the user simply has no shares. They can still be owner (via `project.userId === email`) or admin. This is not an error condition -- handle gracefully.
**Warning signs:** Null dbUser should not block access for owners or admins.

### Pitfall 3: Return Shape Backward Compatibility
**What goes wrong:** Existing callers destructure `getAuthorizedProject` as `const { project, user, isAdmin } = await getAuthorizedProject(id)`. Adding new fields (`role`, `canEdit`) is safe. But if the `project` object shape changes (e.g., now includes `shares` relation), callers that spread `project` into responses might leak share data.
**Why it happens:** Prisma `include` changes the return type.
**How to avoid:** Use `select` on the shares include to only fetch `role`, not full share records. Or strip shares from the returned project object.
**Warning signs:** TypeScript compilation errors, or share data appearing in client responses.

### Pitfall 4: Double Auth Calls in Server Actions
**What goes wrong:** Some server actions call `getAuthorizedProject` and then separately query the project again. With the new role resolution adding a User lookup, this doubles the overhead.
**Why it happens:** Historical pattern where auth returns minimal data and the action re-queries with includes.
**How to avoid:** `getAuthorizedProject` returns the full project. Actions that need specific includes should either (a) accept the project from auth and add a targeted follow-up query, or (b) continue the two-query pattern but use the role from the first call.
**Warning signs:** Performance regression on actions that now do 4 queries instead of 2.

### Pitfall 5: Viewer Guard on createProject
**What goes wrong:** `createProject` in `server/actions/projects.ts` uses `getCurrentUser()` directly, not `getAuthorizedProject()`, because there's no existing project to authorize against. A viewer guard here makes no sense.
**Why it happens:** Project creation is a user-level action, not project-level.
**How to avoid:** Skip viewer guard for `createProject`. Only add guards to actions that operate on an existing project.
**Warning signs:** Users unable to create new projects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role hierarchy comparison | Custom if/else chains in each caller | Centralized `resolveRole()` pure function | One place to change if roles are added/reordered |
| Share-based project listing | Manual SQL joins or N+1 share lookups | Prisma `include` with `where` filter on shares | Prisma handles the join correctly, type-safe |
| Request-scoped User.id caching | Custom middleware or context provider | Simple per-call `db.user.findUnique` | Sub-ms indexed lookup; caching adds complexity for negligible gain |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `project.userId !== user.email` inline checks | Centralized `getAuthorizedProject()` | v3.0 | Most checks already centralized; 7 API routes remain |
| Binary access (owner or admin only) | Role-based (admin/owner/editor/viewer) | Phase 31 (this phase) | Enables sharing features |
| `{ project, user, isAdmin }` return | `{ project, user, role, canEdit, isAdmin }` return | Phase 31 (this phase) | Downstream phases consume role info |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run lib/auth/__tests__/authorization.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Role resolution: admin > owner > editor > viewer > none | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "resolveRole"` | Extend existing file |
| AUTH-01 | getAuthorizedProject returns correct role for shared users | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProject"` | Extend existing file |
| AUTH-01 | getAuthorizedProjects includes shared projects with roles | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProjects"` | Extend existing file |
| AUTH-02 | Viewer mutation rejection returns `{ success: false, error }` | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "viewer"` | Extend existing file |
| AUTH-02 | Mutation server actions reject viewer access | unit | `npx vitest run server/actions/__tests__/viewer-guards.test.ts` | Wave 0 |
| AUTH-03 | Admin bypasses all share checks | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "admin"` | Extend existing file |
| AUTH-01 | API routes use centralized helpers (no inline checks) | manual | Grep for `project.userId !== user.email` outside lib/auth/ | Manual verification |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/auth/__tests__/authorization.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + grep verification for no remaining inline checks

### Wave 0 Gaps
- [ ] Extend `lib/auth/__tests__/authorization.test.ts` -- add mocks for `db.user.findUnique` and `project.shares`, add tests for role resolution, viewer guards, shared project listing
- [ ] Add `db.user` mock to existing test setup (currently only mocks `db.project`)

## Open Questions

1. **API Route notFound() vs JSON 404**
   - What we know: Current inline checks return `NextResponse.json({ error: "..." }, { status: 404 })`. Centralized `getAuthorizedProject` calls `notFound()` which produces HTML 404.
   - What's unclear: Whether polling clients (useEffect-based fetch) handle HTML 404 gracefully or need JSON.
   - Recommendation: Have route-specific helpers (`getAuthorizedRun`) catch `notFound()` and re-throw as a custom error, or have API routes wrap calls in try-catch. The planner should decide which approach is cleaner.

2. **Export Actions as Mutations**
   - What we know: JIRA export and DOCX export are in the mutation list (D-05 says viewers can't trigger exports).
   - What's unclear: Whether "read-only export" (just generating a file) should truly be blocked for viewers.
   - Recommendation: Follow D-05 as written -- all exports are mutations blocked for viewers. This can be relaxed later if needed.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `lib/auth/authorization.ts` (current implementation)
- Direct code inspection of `lib/auth/__tests__/authorization.test.ts` (existing test patterns)
- Direct code inspection of `prisma/schema.prisma` (User, ProjectShare, Project models)
- Direct code inspection of all 7 API routes with inline auth
- Direct code inspection of all 11 server action files
- Phase 31 CONTEXT.md (locked decisions D-01 through D-13)

### Secondary (MEDIUM confidence)
- Phase 30 CONTEXT.md referenced for User.id/email design decisions
- Auth callback `route.ts` for User upsert pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; Prisma + Next.js patterns are well-understood from existing codebase
- Architecture: HIGH - Extending existing centralized module with clear decisions from CONTEXT.md
- Pitfalls: HIGH - All identified from direct code inspection of existing patterns

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- no external dependency changes expected)
