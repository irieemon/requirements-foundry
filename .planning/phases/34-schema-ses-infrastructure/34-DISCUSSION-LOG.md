# Phase 34: Schema & SES Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 34-schema-ses-infrastructure
**Areas discussed:** BugReport schema design, SES CDK integration, Environment variable strategy, Migration naming & timing

---

## BugReport Schema Design

### Scope: Project relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Project-independent | Bug reports are app-level feedback, stores submitterEmail/submitterName directly | ✓ |
| Linked to Project | FK to Project, enables per-project filtering, nullable projectId | |
| Linked to User | FK to User table, reports survive email changes | |

**User's choice:** Project-independent
**Notes:** Bug reports are app-level feedback, not tied to specific projects.

### Status storage

| Option | Description | Selected |
|--------|-------------|----------|
| String field | Store as String like ProjectShare.role, matches existing pattern | ✓ |
| Prisma enum | Type-safe at DB level, but enum changes require migrations | |

**User's choice:** String field
**Notes:** Consistent with existing ProjectShare.role pattern.

### Admin notes structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single text field | One adminNotes column, admin overwrites/appends in textarea | ✓ |
| Separate notes model | BugReportNote table with timestamps, supports multiple notes | |

**User's choice:** Single text field
**Notes:** Simplest approach for v5.0 scope.

---

## SES CDK Integration

### Email identity type

| Option | Description | Selected |
|--------|-------------|----------|
| Individual email | Verify single sender address, works in sandbox, simplest setup | ✓ |
| Domain identity | Verify entire domain via DNS, send from any @domain address | |

**User's choice:** Individual email
**Notes:** Good for POC, can upgrade to domain identity later.

### Stack placement

| Option | Description | Selected |
|--------|-------------|----------|
| Same stack | Add to RequirementsFoundryStack, consistent with all other resources | ✓ |
| Separate stack | New SesStack with cross-stack references | |

**User's choice:** Same stack
**Notes:** Keeps everything in one place.

### Sandbox handling

| Option | Description | Selected |
|--------|-------------|----------|
| Document manual step | CDK creates identity and IAM policy, manual verification documented | ✓ |
| CDK custom resource | Auto-verify admin email during deploy via AwsCustomResource | |

**User's choice:** Document manual step
**Notes:** Matches existing manual setup pattern (Okta SAML).

---

## Environment Variable Strategy

### Storage mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Plain environment vars | Pass as plain CDK env vars, email addresses aren't sensitive | ✓ |
| SSM Parameter Store | Store in SSM, changeable without redeploy | |
| Secrets Manager | Store alongside SESSION_SECRET, consistent but overkill | |

**User's choice:** Plain environment vars
**Notes:** Email addresses are not sensitive — no need for SSM/Secrets Manager overhead.

### Configuration approach

| Option | Description | Selected |
|--------|-------------|----------|
| CDK context params | Pass via cdk.json or --context flag, configurable per deploy | ✓ |
| Hardcoded in stack | Define directly in stack file, requires code change to update | |

**User's choice:** CDK context params
**Notes:** Allows changing admin email without editing stack code.

---

## Migration Naming & Timing

### Naming convention

| Option | Description | Selected |
|--------|-------------|----------|
| Same YYYYMMDD000000 pattern | Consistent with all 4 existing migrations | ✓ |
| Let Prisma auto-generate | May differ slightly from manual pattern | |

**User's choice:** Same pattern
**Notes:** Consistency with existing migrations.

### Seed data

| Option | Description | Selected |
|--------|-------------|----------|
| Table only | Just creates BugReport table, no seed data | ✓ |
| Include seed script | Pre-populate test data for development | |

**User's choice:** Table only
**Notes:** Status is a plain string field, not a lookup table.

---

## Claude's Discretion

- Exact Prisma field types and annotations
- SES CDK construct choice (L2 vs L1)
- IAM policy scope for ses:SendEmail
- Index strategy on BugReport table

## Deferred Ideas

None — discussion stayed within phase scope.
