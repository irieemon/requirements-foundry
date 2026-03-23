# Pitfalls Research: Adding Project Sharing to a Single-Owner Application

**Domain:** Retrofitting user-to-user project sharing with viewer/editor roles onto an existing single-owner Next.js + Prisma app
**Researched:** 2026-03-23
**Confidence:** HIGH (direct codebase analysis of authorization layer, schema, API routes, and server actions)

---

## Critical Pitfalls

### Pitfall 1: Scattered Ownership Checks Create Authorization Gaps When Adding Shared Access

**What goes wrong:**
The current codebase has ownership checks in two forms: (1) the centralized `getAuthorizedProject()` in `lib/auth/authorization.ts` which checks `project.userId !== user.email`, and (2) inline duplicates of this check in at least 6 API route handlers (`/api/runs/[id]`, `/api/uploads`, `/api/projects/[id]/active-run`, etc.) that each independently check `project.userId !== user.email && !isAdmin(user.email)`. When adding sharing, developers update the centralized function to check the new ProjectShare table but forget to update the inline checks in API routes. Result: a user can access a shared project's page (centralized check updated) but the polling endpoints for active runs return 404 (inline checks not updated). The app appears broken for shared projects -- progress bars never update, runs appear stuck.

**Why it happens:**
The inline ownership checks were a pragmatic choice during v3.0 -- API routes needed authorization but calling the centralized function (which uses `notFound()`) was awkward in API route handlers that need to return JSON responses. Each route handler copied the pattern. Now there are two authorization code paths to maintain, and the second is invisible unless you grep for `project.userId`.

**How to avoid:**
1. Before writing any sharing logic, audit every file that references `project.userId` or `getAuthorizedProject`. The grep shows 14+ production files with inline ownership checks.
2. Refactor ALL ownership checks to flow through a single authorization module that returns a boolean/permission level, not one that calls `notFound()` as a side effect. The centralized function should have two variants: one for pages (throws notFound), one for API routes (returns null or throws a catchable error).
3. The refactored function becomes the ONLY place that knows about ownership, sharing, and admin bypass. Every consumer just calls `canAccessProject(projectId, userEmail)` or `getProjectPermission(projectId, userEmail) => 'owner' | 'editor' | 'viewer' | null`.
4. Add a lint rule or test that greps for `project.userId` outside of the authorization module -- any match is a bug.

**Warning signs:**
- Shared project pages load but polling/progress features silently fail
- Tests pass for the main project page but API-level tests for runs/uploads return 404 for shared users
- You find yourself doing find-and-replace of `project.userId !== user.email` across multiple files

**Phase to address:**
Phase 1 (Authorization refactor) -- must happen BEFORE the ProjectShare table or any sharing UI. This is the foundation.

---

### Pitfall 2: Viewer Role Not Enforced on Mutating Server Actions

**What goes wrong:**
The current system has only two states: "can access" and "cannot access." Adding viewer/editor roles introduces a third state: "can read but not write." Developers add the share check to `getAuthorizedProject()` so shared users can see the project, then mark the feature as done. But every server action that mutates data (create upload, run analysis, generate epics, edit stories, delete cards, trigger JIRA export) still only checks "can access" -- it never asks "can this user WRITE?" A viewer can trigger AI generation runs, delete cards, or export to JIRA on a project they should only be reading.

**Why it happens:**
The existing authorization model is binary (access/no-access). Every server action calls `getAuthorizedProject()` and proceeds to mutate. There is no concept of "read permission" vs "write permission" in the current code. Adding sharing means retrofitting permission levels into 11 server action files (projects.ts, analysis.ts, generation.ts, batch-stories.ts, uploads.ts, epics.ts, subtasks.ts, export.ts, jira-export.ts, mss.ts, questions.ts), and it is easy to miss some.

**How to avoid:**
1. The authorization refactor must return a permission level, not just a boolean. `getAuthorizedProject()` should return `{ project, user, permission: 'owner' | 'editor' | 'viewer' | 'admin' }`.
2. Create a helper: `assertCanEdit(projectId)` that calls the authorization check and throws if the user only has viewer access.
3. Categorize every server action as "read" or "write." Read: `getProject`, `getEpics`, `getStories`, `getSubtasks`, `getRuns`. Write: everything else (create, update, delete, trigger generation, export).
4. Every write action must call `assertCanEdit()`. Every read action can use `assertCanView()`.
5. Write a test for each server action that verifies a viewer gets an appropriate error on mutating calls.

**Warning signs:**
- No tests specifically checking that viewers cannot mutate
- `getAuthorizedProject()` returns the same result for viewers and editors
- Server actions only check "is authorized" without checking permission level
- Manual testing skips trying write operations as a viewer

**Phase to address:**
Phase 1 (Authorization refactor) -- the permission level return value must be designed into the authorization module from the start. Phase 2 (Schema + sharing logic) should include viewer-specific tests.

---

### Pitfall 3: Shared Projects Break the "Entity Chain Ownership" Pattern

**What goes wrong:**
The current architecture uses "entity chain ownership" (noted in PROJECT.md Key Decisions): child entities (uploads, cards, epics, stories, subtasks, runs) don't have a `userId` field. Access is controlled by checking `project.userId` -- if you own the project, you own everything in it. When sharing is added, the query for "projects I can access" becomes a join through the ProjectShare table. But several places in the codebase query child entities WITHOUT going through the project first:

- The Runs page (`/runs`) queries runs directly and joins to `project.userId` for ownership
- Run detail page fetches a run by ID and checks `run.project.userId`
- Upload API route fetches project by ID from the request body

Any query path that reaches child entities without going through the sharing-aware project authorization will either (a) deny access to shared users, or (b) require duplicating the sharing check in every query path.

**Why it happens:**
Entity chain ownership is elegant for single-owner: one check at the project level secures everything. But sharing breaks the assumption that `project.userId === current user` is sufficient. Now you need `project.userId === current user OR project has a share record for current user`. Every query path that checks ownership at the project level must be updated.

**How to avoid:**
1. Audit every query path that accesses child entities. The runs page, run detail page, and upload API are confirmed paths that bypass `getAuthorizedProject()`.
2. Do NOT add userId to child tables (that would be a huge schema change and breaks the chain ownership pattern). Instead, ensure ALL child entity access goes through project-level authorization.
3. For the runs page specifically: instead of querying runs directly with a join to `project.userId`, change to: "get my accessible project IDs (owned + shared), then get runs for those projects."
4. Consider adding a `getAccessibleProjectIds(userEmail)` helper that returns all project IDs the user can access (owned + shared + admin-all). This becomes the building block for all list queries.

**Warning signs:**
- Shared users see the project page but the runs page shows no runs for shared projects
- Run detail pages return 404 for shared users even though the project shows in their list
- Upload endpoints reject requests from shared editors because they check `project.userId` directly

**Phase to address:**
Phase 1 (Authorization refactor) -- the `getAccessibleProjectIds()` helper must be designed alongside the main authorization changes. Phase 3 (UI changes) will expose these gaps if they exist.

---

### Pitfall 4: "Shared With Me" Section Creates N+1 Query on Projects Page

**What goes wrong:**
The projects page currently calls `getAuthorizedProjects()` which does one query: `findMany({ where: { userId: user.email } })`. Adding "Shared with me" naively means two queries: one for owned projects, one for shared projects (join through ProjectShare). The shared projects query must include the sharer's name/email for display AND the `_count` includes (uploads, cards, epics, runs) that the current page depends on. Developers write this as: fetch shared project IDs, then fetch each project with its counts. With 10 shared projects, this is 11 queries. The page load time doubles.

But the deeper problem is the projects page component. It currently receives a flat `projects[]` array and maps over it. Adding a "Shared with me" section means the component must now handle two lists, display the owner's name for shared projects, show the user's role (viewer/editor), and potentially disable action buttons for viewers. If this isn't designed upfront, the component becomes a mess of conditional rendering.

**Why it happens:**
The current page was designed for a single list. The temptation is to bolt on a second list below it. But sharing adds new data requirements (share role, owner name) that don't exist in the current Project model return shape.

**How to avoid:**
1. Use a single query that returns both owned and shared projects with a discriminator:
   ```
   SELECT p.*, 'owner' as access_type, NULL as shared_by
   FROM Project p WHERE p.userId = $email
   UNION ALL
   SELECT p.*, ps.role as access_type, ps.sharedBy as shared_by
   FROM Project p JOIN ProjectShare ps ON p.id = ps.projectId WHERE ps.userEmail = $email
   ```
   In Prisma, this requires either raw SQL or two `findMany` calls combined in JavaScript (acceptable at this scale).
2. Return a unified type: `ProjectWithAccess = Project & { accessType: 'owner' | 'editor' | 'viewer', sharedBy?: string }`.
3. The component receives a single list, groups by `accessType === 'owner'` vs shared, and renders two sections.
4. Include `_count` in both queries to avoid N+1.

**Warning signs:**
- Projects page load time increases noticeably after adding sharing
- The projects page component has deep conditional nesting (`if owned... else if shared... else if admin...`)
- Two separate API calls for owned vs shared projects

**Phase to address:**
Phase 2 (Schema + data layer) for the query design. Phase 3 (UI) for the component restructuring. Design the return type in Phase 2 so Phase 3 has clean data to work with.

---

### Pitfall 5: Share Management UI Allows Sharing With Users Who Don't Exist Yet

**What goes wrong:**
The requirements specify "User picker showing accounts who have previously signed in." This implies sharing is limited to users already in the system. But the current schema has no User table -- users exist only as `userId` (email) strings on the Project model and as entries in the Cognito User Pool. If the share UI lets you type any email, you can create a ProjectShare record for `nobody@merkle.com` who has never signed in. That share record sits orphaned. If that person later signs in, they unexpectedly see a shared project. If they never sign in, the owner sees a share entry that appears active but the recipient never sees it.

A more subtle variant: the user picker queries Cognito for all users (expensive API call, rate limited at 5 req/sec for `ListUsers`), or it queries the Project table for distinct `userId` values (fast but may miss users who signed in but never created a project).

**Why it happens:**
The app has no local User table because v3.0 didn't need one -- identity comes from Cognito and the session cookie. Sharing requires knowing "who exists" and the app doesn't track that locally.

**How to avoid:**
1. Add a `User` table that gets populated on first sign-in (upsert in the auth callback or session creation). Fields: `email` (unique), `name`, `firstSeenAt`, `lastSeenAt`.
2. The user picker queries this local User table, not Cognito. Fast, no API rate limits, always consistent with who has actually signed in.
3. ProjectShare references the User table's email (or ID) with a foreign key, preventing shares to non-existent users.
4. On the auth callback, upsert the user: `db.user.upsert({ where: { email }, create: { email, name }, update: { lastSeenAt: new Date() } })`.

**Warning signs:**
- Share UI shows "no users found" because there's no User table to query
- Developer creates a Cognito ListUsers API call that's slow and hits rate limits
- Shares exist for email addresses that never correspond to a logged-in user

**Phase to address:**
Phase 2 (Schema) -- the User table and the upsert-on-login must be in place before the share UI is built. The ProjectShare table should foreign-key to User.

---

### Pitfall 6: Admin "View All Projects" Conflicts With Sharing Semantics

**What goes wrong:**
The admin currently has a toggle: "My Projects" vs "All Projects." With sharing, there are now three categories for the admin: (1) projects they own, (2) projects shared with them, (3) all projects (admin override). The "All Projects" toggle bypasses ownership checks entirely (`where: {}` -- no filter). This means the admin's "All Projects" view shows projects shared with them identically to projects they have no relationship with. The admin cannot distinguish "shared with me as editor" from "I'm seeing this because I'm admin." Worse: if the admin accesses a shared project via the "All Projects" view, which permission applies -- admin (full access) or the share role (possibly viewer)?

**Why it happens:**
Admin access was designed as a simple bypass: if admin, skip ownership check. Sharing adds a middle layer (explicit access with a role) that admin bypass doesn't understand. The admin always has maximum permissions, which makes the share role meaningless for admins -- but the UI might still show "Viewer" next to the admin's name in the share list.

**How to avoid:**
1. Define a clear permission hierarchy: `admin > owner > editor > viewer`. An admin always has full access regardless of share role.
2. In the UI, add a third section for admins: "My Projects" / "Shared With Me" / "All Projects (Admin)". Or keep the toggle but show access indicators on each project card.
3. In the authorization module, resolve permissions in order: (a) is admin? -> full access. (b) is owner? -> full access. (c) has share? -> share role. (d) none -> no access.
4. Don't add share records for admins -- admin access is implicit. If an admin wants to be listed as a collaborator, they can be shared explicitly, but their effective permission is always admin-level.

**Warning signs:**
- Admin sees duplicate entries (one from sharing, one from admin view)
- Permission resolution is ambiguous when admin has both admin role and a share record
- Tests don't cover the admin + shared scenario

**Phase to address:**
Phase 1 (Authorization refactor) -- the permission hierarchy must be defined in the authorization module. Phase 3 (UI) -- the projects page must handle the three-category display for admins.

---

### Pitfall 7: Concurrent AI Runs on Shared Projects Cause Conflicts

**What goes wrong:**
Currently, only the project owner can trigger AI runs (analysis, epic generation, story generation, subtask generation). The system prevents concurrent runs on the same project. With sharing, an editor can also trigger runs. If two editors (or the owner and an editor) trigger generation simultaneously, the system may create duplicate runs, overwrite each other's results, or leave the project in an inconsistent state. The current "active run" detection queries for a running/queued run on the project but doesn't lock against concurrent creation.

**Why it happens:**
Single-owner means single-writer. The UI only shows one user at a time, so concurrent mutations are rare. With sharing, multiple users can be on the same project page simultaneously, each able to trigger operations.

**How to avoid:**
1. Keep the existing "one active run per type per project" constraint but make it robust against races. Use a database-level unique constraint or an atomic check-and-create (Prisma `create` with a unique constraint on `[projectId, status]` where status is RUNNING/QUEUED -- though this is complex in Prisma).
2. Simpler approach: in the server action that creates a run, wrap the check-and-create in a transaction with a row-level lock on the project. Check for active runs, create if none, all within the transaction.
3. Show real-time status: if another user has a run in progress, show "Run in progress (started by user@example.com)" instead of hiding the trigger button. This prevents confusion.
4. This is a moderate risk for a POC with few users. Document the limitation and defer robust locking to a later phase if needed.

**Warning signs:**
- Two users trigger story generation simultaneously and get duplicate stories
- "Run already in progress" errors appear unexpectedly for one user
- Run progress shows conflicting states

**Phase to address:**
Phase 2 (Data layer) -- add the transaction-based run creation. Phase 3 (UI) -- show who started the active run. Acceptable to defer real-time awareness to a later milestone.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing share role as a string instead of an enum | No migration needed for new roles | Typos in role strings cause silent failures; no DB-level validation | Never -- use a Prisma enum from the start; it's one migration |
| Skipping the User table and querying Cognito for user list | One fewer table to manage | Cognito ListUsers is rate-limited (5/sec), slow, and can't be joined in SQL | Never -- the User table is trivial to add and essential for sharing |
| Checking share permissions in each server action individually | Works without refactoring authorization module | 11+ server actions with copy-pasted permission checks; one missed = authorization bug | Never -- centralize first, then add sharing |
| Not indexing ProjectShare table | Works fine with < 100 shares | Full table scans on every project access check | Acceptable for POC but add compound index `[projectId, userEmail]` from the start (trivial) |
| Hardcoding "owner" as a virtual role instead of a DB record | Fewer records, owner is just `project.userId` | Owner isn't in the "shares" list, making "who has access" queries require a union | Acceptable for POC; owner-as-implicit is cleaner than creating a self-share record |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prisma schema: ProjectShare table | Making `userEmail` a plain String without a foreign key to User | Add a User table first, then FK from ProjectShare.userEmail to User.email |
| Prisma schema: cascade deletes | Not adding `onDelete: Cascade` on ProjectShare when project is deleted | Add cascade so deleting a project cleans up shares. Without it, orphaned shares accumulate |
| iron-session cookie | Trying to store share permissions in the session cookie | Don't -- permissions change when shares are added/removed. Always check the DB. The cookie only holds identity |
| Admin bypass | Checking sharing BEFORE checking admin status, causing unnecessary DB queries for admins | Check admin first (cheap -- from session), skip share lookup entirely if admin |
| Server action return types | Returning the same shape for owned vs shared projects | Extend return type to include `accessType` and `permission` so the UI can conditionally render |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Checking ProjectShare on every `getAuthorizedProject()` call | Every page load adds a DB query to check shares | Cache the share check result for the duration of the request (React cache or similar). One check per request, not per component | With many components calling `getAuthorizedProject()` on the same page |
| Fetching all shared projects eagerly on the projects list page | Page load slows as users accumulate shares | Paginate or lazy-load the "Shared with me" section separately | When a user has > 50 shared projects |
| User picker querying all users on every keystroke | Laggy autocomplete, unnecessary DB load | Debounce input (300ms), query with LIKE prefix matching, limit to 10 results | When > 100 users exist |
| Joining through ProjectShare for every child entity query | Every runs/uploads/cards query adds a join | Resolve "accessible project IDs" once per request, then use `WHERE projectId IN (...)` | When a user has access to > 100 projects |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Share link/token-based sharing instead of explicit user-to-user | Anyone with the link can access the project; links leak via email, Slack, browser history | Use explicit user email sharing only. No share links for an internal corporate tool |
| Not validating that the sharer is the project owner | Any user who can see a project (even a viewer) can share it with others | Only project owners (and admins) can create/modify shares. Check `project.userId === currentUser.email \|\| isAdmin()` before creating a share |
| Returning 403 instead of 404 for unauthorized shared project access | Leaks project existence to users who aren't shared | Maintain the existing 404-not-403 pattern from v3.0. If a user has no access, they get 404 |
| Trusting the role from the client when creating a share | A crafted request could set role to "admin" or "owner" | Validate role is strictly "viewer" or "editor" on the server. Use a Prisma enum to enforce at DB level |
| Not revoking active sessions when a share is removed | Removing a share from the management UI doesn't take effect until the user's next request, which checks the DB | This is actually fine for this architecture -- the DB is checked on every request. No cached permissions to invalidate |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual distinction between owned and shared projects | User tries to delete a shared project and gets an error | Show clear "Owner: name" label on shared projects; hide destructive actions (delete, share management) for non-owners |
| Share management buried in project settings | Owner doesn't realize they can share, or can't find how to manage shares | Add a visible "Share" button on the project card/header. Use a dialog/drawer, not a separate page |
| User picker requires exact email match | Owner can't remember the exact email of a colleague | Autocomplete that searches by name AND email, showing both. "Sean McInerney (sean.mcinerney@merkle.com)" |
| No confirmation when removing a share | Owner accidentally removes a colleague's access | Show confirmation dialog: "Remove access for [name]? They will no longer be able to view this project." |
| Editor sees all UI controls but actions fail for viewer | Viewer clicks "Generate Stories," nothing happens or they get a confusing error | Disable or hide mutating controls for viewers. Show tooltip: "You have view-only access to this project" |

## "Looks Done But Isn't" Checklist

- [ ] **Authorization centralization:** Grep for `project.userId` outside of `lib/auth/authorization.ts` -- any match in production code (not tests/planning) means there's an inline check that doesn't know about sharing
- [ ] **Viewer enforcement:** For each of the 11 server action files, verify that mutating functions check for editor/owner permission, not just access
- [ ] **Runs page for shared users:** Navigate to `/runs` as a shared user and verify runs for shared projects appear (this page queries runs directly, not through projects)
- [ ] **Run detail for shared users:** Navigate to `/runs/[id]` for a run on a shared project -- the inline `run.project.userId !== user.email` check in the route handler must be sharing-aware
- [ ] **Upload endpoint for shared editors:** POST to `/api/uploads` for a shared project -- the route handler checks `project.userId !== user.email` inline
- [ ] **Active run polling:** The three `/api/projects/[id]/active-*` routes all have inline ownership checks. Verify shared users get run progress updates
- [ ] **Admin + shared user scenario:** An admin is also shared on a project as viewer. Verify admin still has full access (admin overrides viewer role)
- [ ] **Project deletion cascade:** Delete a project that has shares. Verify no orphaned ProjectShare records
- [ ] **User table populated:** After deploying, verify the User table has entries for all users who have ever signed in (check count matches Cognito user count)
- [ ] **Share removal takes effect immediately:** Remove a share, then have that user refresh the page -- they should get 404, not cached access

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missed inline ownership check (P1) | MEDIUM | Find and update the specific route handler. No data exposure if 404 was returned (access denied, not granted). If granted, audit access logs |
| Viewer can mutate (P2) | MEDIUM | Add `assertCanEdit()` call to the affected server action. Undo any mutations made by viewers (check run history for userId). No permanent damage if caught quickly |
| Entity chain breaks (P3) | LOW | Update the specific query to go through project authorization. No data loss -- just access denial that needs fixing |
| N+1 queries (P4) | LOW | Rewrite query to use join or `IN` clause. Pure performance issue, no data impact |
| Orphaned shares / missing User table (P5) | LOW | Add User table, backfill from Cognito `ListUsers` or from distinct `project.userId` values. Clean up orphaned shares |
| Admin permission ambiguity (P6) | LOW | Define hierarchy in authorization module. Admin always wins. No data risk, just UX confusion |
| Concurrent run conflicts (P7) | MEDIUM | Add transaction-based run creation. For any duplicate runs already created, mark extras as CANCELLED and re-run |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1: Scattered ownership checks | Phase 1 (Auth refactor) | `grep -r "project.userId" --include="*.ts" app/ server/ lib/` returns matches ONLY in `lib/auth/authorization.ts` |
| P2: Viewer not enforced on writes | Phase 1 (Auth refactor) + Phase 2 (Tests) | Automated test: viewer calls each mutating server action and gets permission error |
| P3: Entity chain breaks for shared access | Phase 1 (Auth refactor) | Shared user can view runs page, run details, and upload status for shared projects |
| P4: N+1 on projects page | Phase 2 (Schema + data layer) | Projects page loads in < 500ms with 20 shared projects (check network tab) |
| P5: No User table for share targets | Phase 2 (Schema) | `SELECT COUNT(*) FROM "User"` matches number of distinct users who have signed in |
| P6: Admin vs sharing ambiguity | Phase 1 (Auth refactor) | Admin with viewer share still has full access; admin "All Projects" view distinguishes access types |
| P7: Concurrent run conflicts | Phase 2 (Data layer) | Two simultaneous run triggers on same project: first succeeds, second gets "run already in progress" |

## Sources

- Direct codebase analysis of `lib/auth/authorization.ts` (centralized auth with inline check pattern)
- Direct codebase analysis of `prisma/schema.prisma` (entity chain ownership, no User table)
- Direct analysis of 6 API route handlers with inline `project.userId` checks
- Direct analysis of 11 server action files using `getAuthorizedProject()`
- PROJECT.md Key Decisions: "Entity chain ownership (not userId on every table)" and "404-not-403 for unauthorized access"
- v3.0 authorization implementation patterns from `.planning/milestones/v3.0-phases/28-data-isolation/`

---
*Pitfalls research for: Adding project sharing (viewer/editor roles) to Requirements Foundry v4.0*
*Researched: 2026-03-23*
