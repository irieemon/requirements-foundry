# Phase 30: Data Foundation - Research

**Researched:** 2026-03-23
**Domain:** Prisma schema evolution, data migration, authentication callback integration
**Confidence:** HIGH

## Summary

Phase 30 creates the User table and ProjectShare junction table, adds a login-time upsert to the auth callback, and backfills existing users from Project.userId. This is a pure data-layer phase with no UI changes and no modifications to the authorization module (that is Phase 31).

The codebase already follows strong conventions: cuid IDs, cascade deletes, @@index on foreign keys, and a centralized Prisma client. The new models follow these patterns exactly. The migration requires a backfill step that populates User records from `SELECT DISTINCT userId FROM "Project"` -- these are email strings, so backfilled users will have null display names until they log in again.

**Primary recommendation:** Use Prisma string type for role (not enum) for simplicity and downstream flexibility. Implement the User upsert directly in the auth callback route after session.save(). Write the backfill as raw SQL in the migration file, consistent with the existing migration pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** User table uses cuid as primary key (`User.id = cuid()`), with `email` as a unique constraint field
- **D-02:** `Project.userId` remains an email string in this phase -- no FK change. Phase 31 can add the FK relationship when refactoring authorization
- **D-03:** User table fields: `id` (cuid), `email` (unique), `name` (nullable string), `createdAt`, `updatedAt`
- **D-04:** When a user has no display name (backfilled users who haven't logged in again), show the full email address as fallback
- **D-05:** Display name auto-populates on next login via the upsert mechanism
- **D-06:** `ProjectShare.userId` is a proper FK to `User.id` (cuid), not an email string
- **D-07:** Only users who exist in the User table can be shared with (referential integrity enforced)
- **D-08:** ProjectShare fields: `id` (cuid), `projectId` (FK to Project), `userId` (FK to User), `role` (string: "viewer" | "editor"), `createdAt`
- **D-09:** Unique constraint on `[projectId, userId]` -- a user can only have one role per project
- **D-10:** User upsert happens in the auth callback (`app/api/auth/callback/`) right after token exchange succeeds
- **D-11:** Upsert uses email as the match key, updates `name` from Cognito claims on each login
- **D-12:** Single location, runs once per login -- no per-request overhead

### Claude's Discretion
- Role storage: string vs Prisma enum for the role field
- Migration approach for backfilling: exact SQL strategy for populating User table from existing `Project.userId` values
- Index strategy on ProjectShare (beyond the unique constraint)
- Cascade behavior on User deletion (unlikely scenario but schema should handle it)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | User can have their identity stored locally on first login (User table with email, display name, timestamps) | User model schema (D-01, D-03), upsert in auth callback (D-10, D-11), backfill migration for existing users |
| DATA-02 | User can have a project shared with them via a ProjectShare record (projectId, userId, role: viewer/editor) | ProjectShare model schema (D-06, D-08, D-09), cascade delete from Project, FK to User table |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^7.2.0 | ORM, schema management, migrations | Already used throughout codebase; @prisma/client and @prisma/adapter-pg installed |
| PostgreSQL | (RDS) | Database | Production database; all migrations target PostgreSQL |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.16 | Test runner | Existing test framework; auth tests already use vi.mock pattern |

No new dependencies are needed for this phase. Everything uses existing Prisma and the auth callback route.

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma                                    # ADD User and ProjectShare models
  migrations/20260323000000_add_user_and_shares/   # New migration with backfill SQL

app/api/auth/callback/
  route.ts                                         # MODIFY: add User upsert after session.save()

lib/auth/__tests__/
  authorization.test.ts                            # EXISTS: extend with User upsert tests (or new file)
```

### Pattern 1: Prisma Model with cuid and Cascade (Established Pattern)
**What:** All models use `@id @default(cuid())`, foreign keys have `@@index`, parent deletion cascades to children.
**When to use:** Every new model in this codebase.
**Example (from existing schema):**
```prisma
model Upload {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  // ...
  @@index([projectId])
}
```

### Pattern 2: User Upsert in Auth Callback
**What:** After the session is saved in `app/api/auth/callback/route.ts`, call `db.user.upsert()` using email as the match key. Update name on every login.
**When to use:** Once, in the auth callback.
**Example:**
```typescript
// After session.save() in the auth callback
await db.user.upsert({
  where: { email: session.user.email },
  update: { name: session.user.name },
  create: {
    email: session.user.email,
    name: session.user.name,
  },
});
```

**Key detail:** The `name` field in UserInfo is populated from `cognito:username` or falls back to email (line 60-61 of callback route). This means the display name will be whatever Cognito provides. The upsert updates it on every login so if the Cognito user's name changes, it propagates.

### Pattern 3: Backfill Migration with Raw SQL
**What:** The migration creates the User table, then populates it from existing Project.userId values using raw SQL in the migration file.
**When to use:** When creating tables that need historical data from existing tables.
**Example (consistent with existing migration `20260310000000_add_user_ownership`):**
```sql
-- Create User table
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Backfill: create User records from existing Project owners
-- Uses gen_random_uuid() as a cuid-like ID generator for migration purposes
-- Name is NULL for backfilled users (D-04: email shown as fallback)
INSERT INTO "User" ("id", "email", "updatedAt")
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  "userId",
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "Project") AS distinct_users;

-- Create ProjectShare table
CREATE TABLE "ProjectShare" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectShare_pkey" PRIMARY KEY ("id")
);
-- Indexes and constraints...
```

### Anti-Patterns to Avoid
- **Using Prisma enum for role:** A Prisma `enum` creates a PostgreSQL enum type that requires a migration to add new values. Using a plain `String` field with application-level validation is more flexible for adding roles later (e.g., "commenter" in v5+). Recommendation: use `String` type.
- **Adding FK from Project.userId to User.id:** Decision D-02 explicitly defers this. Project.userId remains an email string. Do not change it in this phase.
- **Running upsert on every request:** Decision D-12 says single location, once per login. Do not add middleware or per-request hooks.
- **Using Prisma's `createMany` for backfill:** Raw SQL in the migration file is more reliable for backfill because it runs as part of `prisma migrate deploy` and does not depend on the Prisma client being generated yet.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation in migration | Custom ID function | `gen_random_uuid()` prefixed with 'c' | cuid is client-side; for SQL migration, a UUID-based string approximation works. Prisma's `@default(cuid())` handles it at runtime |
| Upsert logic | Custom find-then-create | `db.user.upsert()` | Prisma upsert is atomic and handles the race condition of two concurrent logins |
| Migration ordering | Manual SQL file execution | `prisma migrate dev` / `prisma migrate deploy` | Standard tooling handles ordering, checksums, and rollback |

## Common Pitfalls

### Pitfall 1: cuid Generation in Raw SQL
**What goes wrong:** Prisma's `cuid()` default only works at the application layer. Raw SQL in migrations cannot call Prisma's cuid generator.
**Why it happens:** Backfill SQL runs before Prisma client is available.
**How to avoid:** Use `gen_random_uuid()` (available in PostgreSQL 13+) with a 'c' prefix to approximate cuid format, OR use Prisma's `$executeRaw` in a seed script instead. For a migration, the UUID approach is simplest.
**Warning signs:** Migration fails with "function cuid() does not exist".

### Pitfall 2: Missing updatedAt in Backfill
**What goes wrong:** Prisma's `@updatedAt` decorator expects a non-null value. If the backfill INSERT omits `updatedAt`, the column will be NULL and Prisma will throw errors when reading these records.
**Why it happens:** `@updatedAt` is managed by Prisma at runtime, but raw SQL must set it explicitly.
**How to avoid:** Always include `"updatedAt" = CURRENT_TIMESTAMP` in backfill INSERT statements.
**Warning signs:** "Column updatedAt cannot be null" errors when querying backfilled records.

### Pitfall 3: Auth Callback Error Handling
**What goes wrong:** If the User upsert fails (database connection error, etc.), the login succeeds (session is already saved) but the User record is not created.
**Why it happens:** The upsert is added after `session.save()`.
**How to avoid:** Wrap the upsert in a try-catch that logs the error but does not prevent login. The user will be created on next login. This is acceptable because sharing features are not available until the User record exists.
**Warning signs:** Users who logged in during a database outage have sessions but no User records.

### Pitfall 4: Unique Constraint Violation on ProjectShare
**What goes wrong:** Attempting to create two ProjectShare records for the same (projectId, userId) pair throws a unique constraint violation.
**Why it happens:** Decision D-09 enforces this at the database level.
**How to avoid:** Use `upsert` or check existence before creating. For Phase 30, this is schema-only -- the actual share creation logic comes in Phase 32.
**Warning signs:** P2002 unique constraint error from Prisma.

### Pitfall 5: Cascade Delete Chain
**What goes wrong:** Deleting a Project should cascade to ProjectShare records. Deleting a User should cascade to their ProjectShare records. If cascade is missing, orphaned records accumulate.
**Why it happens:** Forgetting `onDelete: Cascade` on the relation.
**How to avoid:** Add `onDelete: Cascade` on both ProjectShare.project and ProjectShare.user relations. This matches the existing pattern (Upload, Card, Epic all cascade from Project).
**Warning signs:** Foreign key constraint violations when deleting Projects or Users.

## Code Examples

### User Model (Prisma Schema)
```prisma
// Source: Established codebase pattern + D-01, D-03
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shares ProjectShare[]
}
```

### ProjectShare Model (Prisma Schema)
```prisma
// Source: D-06, D-07, D-08, D-09
model ProjectShare {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   // "viewer" | "editor"
  createdAt DateTime @default(now())

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}
```

### Project Model Addition
```prisma
// Add to existing Project model
model Project {
  // ... existing fields ...
  shares ProjectShare[]
}
```

### Auth Callback Upsert (D-10, D-11, D-12)
```typescript
// Source: D-10, D-11 -- add after session.save() in app/api/auth/callback/route.ts
import { db } from "@/lib/db";

// Inside the try block, after session.save():
try {
  await db.user.upsert({
    where: { email: session.user.email },
    update: { name: session.user.name },
    create: {
      email: session.user.email,
      name: session.user.name,
    },
  });
} catch (upsertError) {
  // Log but don't block login -- user will be created on next login
  console.error("User upsert failed:", upsertError);
}
```

### Index Strategy Recommendation (Claude's Discretion)
```prisma
// Beyond the unique constraint on [projectId, userId]:
// - @@index([projectId]) -- "get all shares for a project" (share management dialog)
// - @@index([userId]) -- "get all projects shared with me" (projects page)
// Both are standard FK indexes matching the codebase convention
```

### Cascade Behavior on User Deletion (Claude's Discretion)
```prisma
// Recommendation: Cascade delete ProjectShare records when a User is deleted
// Rationale: If a user is removed, their share access should be revoked automatically
// This matches the existing cascade pattern (Project -> Upload -> Card, etc.)
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.16 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run lib/auth/__tests__/ --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01a | User model exists with correct fields | unit (schema) | `npx vitest run lib/auth/__tests__/user-upsert.test.ts -t "User model"` | Wave 0 |
| DATA-01b | Login creates/updates User record via upsert | unit | `npx vitest run lib/auth/__tests__/user-upsert.test.ts -t "upsert"` | Wave 0 |
| DATA-01c | Backfilled users appear in User table | migration | Manual: run `prisma migrate deploy` then query User table | manual-only (migration SQL) |
| DATA-02a | ProjectShare can be created with valid FK refs | unit | `npx vitest run lib/auth/__tests__/project-share.test.ts -t "create"` | Wave 0 |
| DATA-02b | Unique constraint prevents duplicate shares | unit | `npx vitest run lib/auth/__tests__/project-share.test.ts -t "unique"` | Wave 0 |
| DATA-02c | Deleting a project cascades to its shares | unit | `npx vitest run lib/auth/__tests__/project-share.test.ts -t "cascade"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/auth/__tests__/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `lib/auth/__tests__/user-upsert.test.ts` -- covers DATA-01a, DATA-01b (upsert logic with mocked db)
- [ ] `lib/auth/__tests__/project-share.test.ts` -- covers DATA-02a, DATA-02b, DATA-02c (schema validation with mocked db)

Existing `lib/auth/__tests__/authorization.test.ts` provides the vi.mock pattern for `@/lib/db` -- new test files should follow the same mock structure.

## Discretion Recommendations

### Role Storage: String (not Prisma enum)
**Recommendation:** Use `String` type with application-level validation.
**Rationale:**
- PostgreSQL enums require a migration to add values (e.g., future "commenter" role)
- The codebase already uses string-based status fields throughout (Run.status, RunUpload.status, etc.) with the single exception of RunStoryStatus
- String is consistent with the majority pattern
- Application validation (checking against allowed values) is simpler to change than schema migration
**Confidence:** HIGH

### Migration Backfill Strategy
**Recommendation:** Single migration file with DDL + DML in this order:
1. CREATE TABLE "User" with all columns and indexes
2. INSERT INTO "User" from SELECT DISTINCT "userId" FROM "Project"
3. CREATE TABLE "ProjectShare" with all columns, indexes, and foreign keys
**Rationale:**
- ProjectShare has FK to User, so User must exist first
- Backfill runs inline in the migration, not as a separate seed step
- Consistent with existing migration pattern (see `20260310000000_add_user_ownership`)
**Confidence:** HIGH

### Index Strategy
**Recommendation:** Three indexes on ProjectShare:
1. `@@unique([projectId, userId])` -- prevents duplicate shares (from D-09)
2. `@@index([projectId])` -- query all shares for a project
3. `@@index([userId])` -- query all projects shared with a user
**Rationale:** Standard FK index pattern used throughout the codebase. The unique constraint also serves as an index for the compound lookup, but individual column indexes support single-column queries efficiently.
**Confidence:** HIGH

### Cascade on User Deletion
**Recommendation:** `onDelete: Cascade` on ProjectShare.user relation.
**Rationale:** If a user is deleted, their share records are meaningless. Cascade matches the established pattern. User deletion is unlikely in practice (corporate SSO users persist), but the schema should handle it cleanly.
**Confidence:** HIGH

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- existing schema patterns, model conventions, index strategy
- `app/api/auth/callback/route.ts` -- current auth callback flow, session.user field population
- `lib/auth/authorization.ts` -- current authorization pattern, return shape
- `lib/auth/types.ts` -- UserInfo interface with email, name, sub, groups
- `lib/auth/__tests__/authorization.test.ts` -- test mock patterns for db, getCurrentUser, notFound
- `prisma/migrations/20260310000000_add_user_ownership/migration.sql` -- existing migration pattern
- `.planning/research/ARCHITECTURE.md` -- architectural decisions for sharing feature

### Secondary (MEDIUM confidence)
- `.planning/phases/30-data-foundation/30-CONTEXT.md` -- user decisions D-01 through D-12
- `.planning/REQUIREMENTS.md` -- DATA-01, DATA-02 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, versions confirmed from package.json
- Architecture: HIGH -- patterns directly observed in existing codebase, no new libraries needed
- Pitfalls: HIGH -- derived from direct code inspection of migration files, auth callback, and Prisma schema

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, no external API dependencies)
