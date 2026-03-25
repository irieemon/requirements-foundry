# Phase 30: Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 30-data-foundation
**Areas discussed:** User identity key, Display name gaps, ProjectShare FK design, Login upsert location

---

## User Identity Key

| Option | Description | Selected |
|--------|-------------|----------|
| cuid primary key | User.id = cuid, User.email = unique. Project.userId stays as-is (still email string, no FK yet). Phase 31 can add FK when refactoring authorization. | ✓ |
| Email as primary key | User.id = email (the PK itself). Simpler FK but email changes cascade painfully. | |
| You decide | Let Claude pick based on codebase patterns. | |

**User's choice:** cuid primary key (Recommended)
**Notes:** Keeps migration small and safe. Project.userId unchanged in this phase.

---

## Display Name Gaps

| Option | Description | Selected |
|--------|-------------|----------|
| Show email | Display the email address as fallback. Simple, always available, unambiguous. Name populates on next login. | ✓ |
| Email prefix only | Show 'sean.mcinerney' instead of full email. Cleaner but less precise with multiple domains. | |
| You decide | Let Claude pick the best fallback approach. | |

**User's choice:** Show email (Recommended)
**Notes:** Name auto-populates on next login via upsert.

---

## ProjectShare FK Design

| Option | Description | Selected |
|--------|-------------|----------|
| FK to User.id | ProjectShare.userId -> User.id (cuid). Proper relational FK with cascade. Requires user to exist before sharing. | ✓ |
| Store email directly | ProjectShare.userEmail stores email string. No FK to User table. Loses referential integrity. | |
| You decide | Let Claude pick based on data integrity needs. | |

**User's choice:** FK to User.id (Recommended)
**Notes:** Only users who exist in the User table can be shared with.

---

## Login Upsert Location

| Option | Description | Selected |
|--------|-------------|----------|
| Auth callback | Upsert in app/api/auth/callback/ right after token exchange. Claims already available. Single location, once per login. | ✓ |
| getCurrentUser helper | Upsert every time getCurrentUser() is called. Guarantees user exists but adds DB write to every request. | |
| You decide | Let Claude pick based on auth flow. | |

**User's choice:** Auth callback (Recommended)
**Notes:** Single location, runs once per login — no per-request overhead.

---

## Claude's Discretion

- Role storage approach (string vs Prisma enum)
- Migration backfill SQL strategy
- ProjectShare index strategy beyond unique constraint
- User deletion cascade behavior

## Deferred Ideas

None — discussion stayed within phase scope.
