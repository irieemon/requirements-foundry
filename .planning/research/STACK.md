# Stack Research: Project Sharing & Role-Based Permissions (v4.0)

**Domain:** Multi-user project sharing with viewer/editor roles
**Researched:** 2026-03-23
**Confidence:** HIGH

## Key Finding: No New Dependencies Required

The existing stack (Prisma 7, Next.js 16, iron-session, Zod 4) provides everything needed for project sharing. This milestone is a **schema + authorization logic change**, not a technology addition.

## What Changes (Within Existing Stack)

### Prisma Schema Addition

| Change | What | Why |
|--------|------|-----|
| New `ProjectShare` model | Junction table: projectId + userEmail + role enum | Explicit many-to-many with metadata (role, timestamps). Prisma 7 supports enum fields and composite unique constraints natively. |
| New `ShareRole` enum | `VIEWER`, `EDITOR` | Prisma enums map to PostgreSQL enums, providing type-safe role validation at the database level. |
| New relation on `Project` | `shares ProjectShare[]` | Enables `include: { shares: true }` in queries and cascading deletes when project is removed. |
| New index | `@@index([userEmail])` on ProjectShare | Required for "Shared with me" queries -- finds all shares for a given user efficiently. |

**Why a junction table, not a JSON field:** The app needs to query "all projects shared with user X" efficiently. A `sharedWith Json?` field on Project would require scanning all projects. A junction table with an index on `userEmail` is O(1) lookup via index scan.

**Why `userEmail` not `userId`:** The existing schema uses `Project.userId` as email string (set from `user.email` in session). There is no `User` table. Keeping consistency with the existing pattern avoids a migration to add a User model. The `userEmail` on ProjectShare matches the same identifier used in `Project.userId`.

### Authorization Module Changes

| Change | File | Why |
|--------|------|-----|
| Extend `getAuthorizedProject()` | `lib/auth/authorization.ts` | Currently checks `project.userId === user.email \|\| isAdmin`. Must add: "OR user has a ProjectShare record for this project." |
| Add role-aware helper | `lib/auth/authorization.ts` | New `getProjectRole()` function returns `'owner' \| 'editor' \| 'viewer' \| null`. Used by UI to conditionally show/hide edit controls. |
| Extend `getAuthorizedProjects()` | `lib/auth/authorization.ts` | Must return both owned projects AND shared projects, with a flag indicating ownership vs shared status. |

### Zod Validation (Already Installed)

| Schema | Purpose | Why Zod |
|--------|---------|---------|
| `shareProjectSchema` | Validate share request: `{ email: z.string().email(), role: z.enum(['VIEWER', 'EDITOR']) }` | Already used throughout the app for form validation (react-hook-form + @hookform/resolvers). No new dependency. |
| `updateShareSchema` | Validate role change: `{ shareId: z.string(), role: z.enum(['VIEWER', 'EDITOR']) }` | Same pattern as existing action validators. |

## What NOT to Add

| Technology | Why NOT | What to Do Instead |
|------------|---------|-------------------|
| CASL / casbin / any RBAC library | Massive overkill for two roles (viewer/editor) on a single resource type (projects). These libraries solve complex cross-resource policy engines. This app has ONE authorization check: "can this user access this project, and at what level?" | Simple `getProjectRole()` function returning `'owner' \| 'editor' \| 'viewer' \| null`. ~20 lines of code. |
| User model / table | The app identifies users by email from Cognito claims. Adding a `User` table requires syncing with Cognito (on first login, etc.), migration complexity, and FK changes across the schema. Not needed for v4.0. | Use `userEmail: String` in ProjectShare, matching the existing `Project.userId` pattern. A User table may make sense in a future milestone for profiles/preferences, but sharing doesn't require it. |
| Invitation / email system | The milestone spec says "User picker showing accounts who have previously signed in." This means sharing with existing users only, not inviting external users. No email delivery needed. | Query `SELECT DISTINCT userId FROM Project` (or add a lightweight seen-users query) to populate the user picker. Users must have logged in at least once. |
| WebSocket / real-time notifications | No requirement for real-time "you've been shared on" notifications. The user discovers shared projects when they visit the projects page. | Shared projects appear in "Shared with me" section on next page load. |
| Middleware-level auth changes | The existing `proxy.ts` route protection already gates all `/projects/[id]` routes through `getAuthorizedProject()`. Sharing just changes what "authorized" means inside that function. | Modify the authorization module only. No middleware changes needed. |
| Row-Level Security (PostgreSQL) | Already ruled out in PROJECT.md (Prisma doesn't support RLS session variables). App-level filtering is the established pattern. | Continue with app-level authorization in `getAuthorizedProject()`. |

## Existing Stack Usage (No Changes Needed)

| Technology | Version | Role in Sharing Feature |
|------------|---------|------------------------|
| Prisma | 7.2.0 | Schema migration for ProjectShare table, typed queries with includes |
| Next.js | 16.1.1 | Server actions for share CRUD, server components for share UI |
| iron-session | 8.0.4 | Session provides `user.email` for authorization checks (unchanged) |
| Zod | 4.3.5 | Input validation for share/unshare actions |
| react-hook-form | 7.70.0 | Share dialog form (email input, role select) |
| @radix-ui/react-dialog | 1.1.15 | Share management modal |
| @radix-ui/react-select | 2.2.6 | Role selector dropdown (VIEWER/EDITOR) |
| lucide-react | 0.562.0 | Share icon, user icons in share list |
| Radix UI components | Various | Already installed: dialog, select, dropdown-menu, alert-dialog -- all needed for share UI |

## Installation

```bash
# No new packages to install.
# The only change is a Prisma migration:
npx prisma migrate dev --name add_project_sharing
```

## Schema Design

```prisma
enum ShareRole {
  VIEWER
  EDITOR
}

model ProjectShare {
  id        String    @id @default(cuid())
  projectId String
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userEmail String    // email of the user being shared with
  role      ShareRole @default(VIEWER)
  sharedBy  String    // email of the user who shared (audit trail)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([projectId, userEmail])  // one share per user per project
  @@index([userEmail])              // fast "shared with me" lookups
  @@index([projectId])              // fast "who has access" lookups
}

// Add to existing Project model:
// shares ProjectShare[]
```

**Design rationale:**
- `@@unique([projectId, userEmail])` prevents duplicate shares and enables upsert for role changes
- `onDelete: Cascade` means deleting a project automatically cleans up all shares
- `sharedBy` provides audit trail without needing a separate audit table
- `ShareRole` enum is extensible if future roles are needed (e.g., COMMENTER)

## Query Patterns

```typescript
// "Shared with me" projects
const sharedProjects = await db.projectShare.findMany({
  where: { userEmail: user.email },
  include: {
    project: {
      include: { _count: { select: { uploads: true, cards: true, epics: true } } }
    }
  }
});

// Authorization check (extended)
const share = await db.projectShare.findUnique({
  where: { projectId_userEmail: { projectId, userEmail: user.email } }
});
const canAccess = project.userId === user.email || isAdmin(user.email) || share !== null;
const canEdit = project.userId === user.email || isAdmin(user.email) || share?.role === 'EDITOR';

// User picker (users who have logged in)
const knownUsers = await db.project.findMany({
  select: { userId: true },
  distinct: ['userId'],
});
```

## Version Compatibility

| Package | Current Version | Sharing Feature Needs | Compatible |
|---------|----------------|----------------------|------------|
| @prisma/client | 7.2.0 | Enum fields, composite unique, relation includes | Yes -- all features stable since Prisma 5+ |
| zod | 4.3.5 | z.enum(), z.string().email() | Yes -- basic validators |
| iron-session | 8.0.4 | No changes needed, provides user.email | Yes |
| next | 16.1.1 | Server actions, server components | Yes |

## Sources

- Existing codebase analysis: `prisma/schema.prisma`, `lib/auth/authorization.ts`, `lib/auth/types.ts`, `package.json`
- PROJECT.md: established patterns (entity chain ownership, 404-not-403, app-level filtering)
- Prisma documentation: enum support, composite unique constraints, relation queries -- all verified as stable features in Prisma 7.x (HIGH confidence, features available since Prisma 4+)

---
*Stack research for: Requirements Foundry v4.0 Project Sharing*
*Researched: 2026-03-23*
