# Architecture Research: Project Sharing Integration

**Domain:** Multi-user project sharing for existing per-user ownership app
**Researched:** 2026-03-23
**Confidence:** HIGH

## Existing Architecture Snapshot

The current system uses a clean, centralized authorization pattern:

```
Project.userId (email string)  =  sole ownership signal
                |
   getAuthorizedProject()  -->  owns it OR isAdmin() ? allow : notFound()
   getAuthorizedProjects() -->  where: { userId: email } (or {} for admin viewAll)
                |
   Entity chain: Project -> Upload -> Card, Project -> Epic -> Story -> Subtask
   (no userId on child tables -- ownership derived by walking up to Project)
```

**Key files that enforce access:**
- `lib/auth/authorization.ts` -- `getAuthorizedProject()`, `getAuthorizedProjects()`, `isAdmin()`
- `server/actions/projects.ts` -- all mutations call `getAuthorizedProject()` first
- `app/(authenticated)/runs/page.tsx` -- inline `where: { project: { userId } }` filter
- `app/(authenticated)/projects/page.tsx` -- calls `getAuthorizedProjects(viewAll)`

## Integration Architecture

### New Data Model: ProjectShare

A single new junction table is all that is needed. No changes to existing tables.

```
+----------------+         +--------------------+
|   Project      | 1-----* |  ProjectShare      |
|                |         |                    |
|  id            |         |  id                |
|  userId        | (owner) |  projectId   FK    |
|  name          |         |  sharedWith        | (email -- matches UserInfo.email)
|  ...           |         |  role              | ("viewer" | "editor")
|                |         |  createdAt         |
|                |         |  createdBy         | (who shared it)
+----------------+         +--------------------+
                              @@unique([projectId, sharedWith])
                              @@index([sharedWith])
                              @@index([projectId])
```

**Why email as the share key (not Cognito `sub`):**
- All existing ownership uses `Project.userId` which stores email
- `UserInfo.email` is the identity pivot throughout the app
- The user picker needs to show emails anyway (corporate SSO, no display names beyond email)
- Consistent with existing patterns -- zero migration of identity format

**Why a junction table (not JSON array on Project):**
- Queryable: "find all projects shared with me" is a single indexed query
- Updatable: add/remove shares without rewriting the whole project row
- Auditable: `createdAt` and `createdBy` per share record
- Standard Prisma relation pattern, no JSON parsing

### Prisma Schema Addition

```prisma
model ProjectShare {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sharedWith String   // email of the user who receives access
  role       String   // "viewer" | "editor"
  createdBy  String   // email of the user who shared it
  createdAt  DateTime @default(now())

  @@unique([projectId, sharedWith])
  @@index([sharedWith])
  @@index([projectId])
}
```

Add to `Project` model:
```prisma
shares ProjectShare[]
```

### Authorization Module Changes

The authorization module (`lib/auth/authorization.ts`) is the **single integration point** for access control. Every page and server action already calls into it.

#### Modified: `getAuthorizedProject()`

Current logic: `owns it OR isAdmin -> allow`
New logic: `owns it OR isAdmin OR has ProjectShare -> allow`

```typescript
export type ProjectRole = "owner" | "editor" | "viewer" | "admin";

export async function getAuthorizedProject(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) notFound();

  // Determine role
  let role: ProjectRole;
  if (isAdmin(user.email)) {
    role = "admin";
  } else if (project.userId === user.email) {
    role = "owner";
  } else {
    // Check for share
    const share = await db.projectShare.findUnique({
      where: {
        projectId_sharedWith: { projectId, sharedWith: user.email },
      },
    });
    if (!share) notFound();
    role = share.role as ProjectRole; // "viewer" | "editor"
  }

  return { project, user, role };
}
```

**Impact:** Every existing call site already destructures `{ project, user, isAdmin }`. Changing the return to include `role` instead of `isAdmin` requires updating call sites, but the logic is straightforward:
- `isAdmin` becomes `role === "admin"` or `role === "owner" || role === "admin"`
- Viewer restrictions: `role === "viewer"` -> hide mutation buttons

#### Modified: `getAuthorizedProjects()`

Must return three categories: owned, shared with me, and (for admin) all.

```typescript
export async function getAuthorizedProjects(viewAll: boolean = false) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  if (admin && viewAll) {
    // Admin all-projects view -- unchanged
    const projects = await db.project.findMany({ where: {}, ... });
    return { ownedProjects: projects, sharedProjects: [], user, isAdmin: true };
  }

  // Own projects
  const ownedProjects = await db.project.findMany({
    where: { userId: user.email },
    ...projectInclude,
  });

  // Shared with me
  const shares = await db.projectShare.findMany({
    where: { sharedWith: user.email },
    include: {
      project: { include: projectCountInclude },
    },
  });
  const sharedProjects = shares.map((s) => ({
    ...s.project,
    shareRole: s.role,
  }));

  return { ownedProjects, sharedProjects, user, isAdmin: admin };
}
```

#### New: Permission Check Helpers

```typescript
export function canEdit(role: ProjectRole): boolean {
  return role === "owner" || role === "editor" || role === "admin";
}

export function canManageShares(role: ProjectRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDelete(role: ProjectRole): boolean {
  return role === "owner" || role === "admin";
}
```

### Runs Page Filter Update

`app/(authenticated)/runs/page.tsx` currently uses an inline query filter:
```typescript
const where = isAdmin(user.email) ? {} : { project: { userId: user.email } };
```

This must expand to include shared projects:
```typescript
const where = isAdmin(user.email)
  ? {}
  : {
      project: {
        OR: [
          { userId: user.email },
          { shares: { some: { sharedWith: user.email } } },
        ],
      },
    };
```

## Component Boundaries

### New Components

| Component | Type | Responsibility |
|-----------|------|----------------|
| `components/projects/share-dialog.tsx` | Client | Modal dialog for managing shares on a project |
| `components/projects/share-user-picker.tsx` | Client | Autocomplete/search for existing users to share with |
| `components/projects/shared-project-list.tsx` | Server/Client | "Shared with me" section on projects page |
| `components/projects/share-badge.tsx` | Client | Shows role badge (Viewer/Editor) on shared project cards |

### Modified Components

| Component | Change |
|-----------|--------|
| `app/(authenticated)/projects/page.tsx` | Split into "My Projects" and "Shared with me" sections |
| `components/projects/project-list.tsx` | Accept `shareRole` prop, conditionally show role badge |
| `components/projects/project-card.tsx` | Show share badge, conditionally hide delete for non-owners |
| `app/(authenticated)/projects/[id]/page.tsx` | Pass `role` down, conditionally hide mutation UI for viewers |
| `app/(authenticated)/runs/page.tsx` | Expand where clause to include shared projects |

### New Server Actions

| Action | File | Purpose |
|--------|------|---------|
| `getProjectShares(projectId)` | `server/actions/sharing.ts` | List current shares for a project |
| `shareProject(projectId, email, role)` | `server/actions/sharing.ts` | Create a share (owner/admin only) |
| `updateShareRole(shareId, role)` | `server/actions/sharing.ts` | Change viewer <-> editor |
| `removeShare(shareId)` | `server/actions/sharing.ts` | Revoke access |
| `searchUsers(query)` | `server/actions/sharing.ts` | Search Cognito users for picker |

### No New API Routes Needed

All mutations use server actions (the existing pattern). The user search for the picker can also be a server action -- it queries Cognito's `ListUsers` API via AWS SDK, which runs server-side.

## Data Flow

### Share Creation Flow

```
Owner clicks "Share" button on project detail page
    |
ShareDialog opens -> owner types email -> UserPicker queries searchUsers()
    |
searchUsers() server action -> Cognito ListUsers API -> returns matching emails
    |
Owner selects user, picks role (viewer/editor) -> calls shareProject()
    |
shareProject() server action:
  1. getAuthorizedProject(projectId) -- verify caller is owner/admin
  2. Verify target email exists in Cognito (prevent sharing with non-existent users)
  3. db.projectShare.create({ projectId, sharedWith, role, createdBy })
  4. revalidatePath(`/projects/${projectId}`)
    |
ShareDialog refreshes share list
```

### Shared Project Access Flow

```
Shared user navigates to /projects
    |
getAuthorizedProjects() returns { ownedProjects, sharedProjects }
    |
Projects page renders two sections:
  "My Projects" -- ownedProjects (existing grid)
  "Shared with me" -- sharedProjects (same grid, with role badges)
    |
User clicks shared project card -> /projects/[id]
    |
getAuthorizedProject(id) checks ProjectShare table -> returns role: "viewer"|"editor"
    |
Project detail page renders with role-based UI:
  viewer: all read sections visible, mutation buttons hidden
  editor: full access (same as owner except no share management or delete)
```

### Authorization Decision Tree

```
getAuthorizedProject(projectId):
  |
  Is user admin?
  |-- YES -> role = "admin" (full access)
  |-- NO
      |
      Is user the owner (Project.userId === email)?
      |-- YES -> role = "owner" (full access + share management)
      |-- NO
          |
          Does ProjectShare exist for (projectId, email)?
          |-- YES -> role = share.role ("viewer" | "editor")
          |-- NO -> notFound() (404, no existence leak)
```

## Recommended Project Structure (New/Modified Files)

```
prisma/
  schema.prisma                             # ADD ProjectShare model
  migrations/2026XXXX_add_project_sharing/  # New migration

lib/auth/
  authorization.ts                          # MODIFY: role-based checks, share lookups

server/actions/
  sharing.ts                                # NEW: share CRUD + user search
  projects.ts                               # MODIFY: return role from getProject

app/(authenticated)/
  projects/
    page.tsx                                # MODIFY: two-section layout
  projects/[id]/
    page.tsx                                # MODIFY: pass role, conditional UI
  runs/
    page.tsx                                # MODIFY: expand where clause

components/projects/
  share-dialog.tsx                          # NEW: share management modal
  share-user-picker.tsx                     # NEW: user autocomplete
  shared-project-list.tsx                   # NEW: "shared with me" section
  share-badge.tsx                           # NEW: role indicator badge
  project-card.tsx                          # MODIFY: role badge, conditional delete
  project-list.tsx                          # MODIFY: accept shareRole prop
```

## Architectural Patterns

### Pattern 1: Centralized Role Resolution

**What:** Resolve the user's role once in `getAuthorizedProject()`, pass it through the component tree. Never re-check authorization in individual components.
**When to use:** Every page/action that accesses a project.
**Trade-offs:** Single source of truth for auth, but requires threading `role` through props.

**Why this fits:** The existing app already uses this exact pattern with `getAuthorizedProject()`. Adding role resolution there means zero new authorization code paths.

### Pattern 2: UI Gating by Role (Not by Data Absence)

**What:** Hide mutation UI elements (upload buttons, delete, analyze, generate) based on `role === "viewer"`, not by removing data from the query.
**When to use:** Project detail page sections.
**Trade-offs:** Simpler than creating separate "read-only" queries. Viewers still receive the same data payload, but this is acceptable -- they already have read access.

**Example:**
```typescript
// In project detail page
const { project, role } = await getProjectWithRole(id);
// Pass role to child components
<AnalyzePanel projectId={project.id} uploads={project.uploads} readOnly={role === "viewer"} />
```

### Pattern 3: Cognito ListUsers for User Discovery

**What:** Use Cognito's `ListUsers` API to find shareable users rather than maintaining a separate users table.
**When to use:** The user picker when sharing a project.
**Trade-offs:** No local user table to maintain. But Cognito ListUsers has a 60-user page limit and is eventually consistent. For a corporate app with <1000 users this is fine.

**Why not a local User table:** The app deliberately avoids one. Users exist only in Cognito. Adding a local User table just for sharing is premature -- Cognito ListUsers with email filter is sufficient for the picker.

## Anti-Patterns

### Anti-Pattern 1: Duplicating Auth Checks in Components

**What people do:** Check `isOwner` or `isShared` inside individual React components or server actions instead of using the centralized authorization module.
**Why it's wrong:** Creates divergent authorization logic. Missed checks = security holes. Violates the existing "single gate" pattern.
**Do this instead:** Always go through `getAuthorizedProject()` which returns the role. Thread the role through props.

### Anti-Pattern 2: Adding userId to Child Tables

**What people do:** Add a `sharedWith` or `accessibleBy` field to every child table (Upload, Card, Epic, etc.).
**Why it's wrong:** The existing design uses entity chain ownership (Project is the root). Adding user references to children breaks this pattern and creates consistency nightmares.
**Do this instead:** Keep authorization at the Project level only. The ProjectShare table is the single addition.

### Anti-Pattern 3: Fetching All Users Eagerly

**What people do:** Load all Cognito users into the picker on dialog open.
**Why it's wrong:** Slow for larger user pools. Unnecessary data transfer.
**Do this instead:** Debounced search-as-you-type. Query Cognito ListUsers with the email filter parameter. Return max 10 results.

### Anti-Pattern 4: Using Middleware for Share Authorization

**What people do:** Try to check share permissions in Next.js middleware.
**Why it's wrong:** The app already avoids middleware for auth (per CVE-2025-29927 decision). Middleware runs on the edge and cannot reliably query the database.
**Do this instead:** Keep authorization in server components and server actions via `getAuthorizedProject()`.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| <50 users (current) | Cognito ListUsers for picker, no caching needed |
| 50-500 users | Add local User table synced via Cognito PostAuth trigger for faster picker queries |
| 500+ users | Add pagination to share management, consider share groups/teams |

### First Bottleneck: User Picker Performance

At ~50+ users, Cognito ListUsers API calls may feel slow (200-500ms per query). Mitigation: add a local `User` table populated by a Cognito PostAuthentication Lambda trigger. This is a future optimization, not needed for v4.0.

### Second Bottleneck: Projects Page Query Count

With many shares, `getAuthorizedProjects()` makes two queries (owned + shared). This is fine for <100 shares per user. If it becomes an issue, combine into a single query with `OR` clause.

## Build Order (Dependency-Driven)

The following order respects dependencies -- each step builds on the previous:

| Phase | What | Why This Order |
|-------|------|----------------|
| 1 | Schema: add `ProjectShare` model + migration | Everything depends on the data model |
| 2 | Authorization: modify `getAuthorizedProject()` to return `role`, add `canEdit()`/`canManageShares()` helpers | All UI and actions depend on role resolution |
| 3 | Server actions: `server/actions/sharing.ts` (CRUD for shares, user search) | Share dialog needs these |
| 4 | UI: Share dialog + user picker components | Core sharing workflow |
| 5 | Projects page: split into "My Projects" / "Shared with me" sections | Depends on `getAuthorizedProjects()` changes |
| 6 | Project detail: role-based UI gating (hide mutations for viewers) | Depends on role being available from step 2 |
| 7 | Runs page: expand filter to include shared projects | Independent of UI work, but needs schema from step 1 |

## Integration Points Summary

### Internal Boundaries

| Boundary | Change | Risk |
|----------|--------|------|
| `authorization.ts` <-> all server actions | Return `role` instead of `isAdmin` boolean | LOW -- mechanical refactor, all call sites known |
| `authorization.ts` <-> Prisma | Add ProjectShare queries | LOW -- standard Prisma relation |
| Projects page <-> ProjectList component | Pass `shareRole` prop | LOW -- additive prop |
| Project detail page <-> child section components | Pass `readOnly` / `role` prop | LOW -- additive prop, children just hide buttons |
| Share dialog <-> Cognito | `ListUsers` API call via AWS SDK | MEDIUM -- new AWS API integration, needs IAM permissions |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cognito | `ListUsers` via `@aws-sdk/client-cognito-identity-provider` | Already in dependencies for auth flow. Need `cognito-idp:ListUsers` IAM permission on ECS task role. Filter by email prefix for search. |

### IAM Permission Addition

The ECS task role needs `cognito-idp:ListUsers` permission scoped to the Cognito User Pool ARN. This is a CDK change in the infra stack.

## Sources

- Codebase analysis: `lib/auth/authorization.ts`, `server/actions/projects.ts`, `prisma/schema.prisma`
- Existing patterns: entity chain ownership (PROJECT.md Key Decisions), centralized authorization module
- Prisma relation patterns: standard junction table with `@@unique` compound key
- AWS Cognito ListUsers: standard SDK pattern, already using `@aws-sdk/client-cognito-identity-provider`

---
*Architecture research for: Requirements Foundry v4.0 Project Sharing*
*Researched: 2026-03-23*
