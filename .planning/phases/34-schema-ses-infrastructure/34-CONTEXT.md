# Phase 34: Schema & SES Infrastructure - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the BugReport data model in PostgreSQL via Prisma migration and add AWS SES email delivery infrastructure to the CDK stack. This phase delivers the data and email foundation — no application code, no UI, no sending logic.

</domain>

<decisions>
## Implementation Decisions

### BugReport Schema Design
- **D-01:** BugReport is project-independent — no FK to Project or User. Stores submitterEmail and submitterName directly as strings. Bug reports are app-level feedback, not project-specific artifacts.
- **D-02:** Status stored as a String field (not Prisma enum), matching the existing ProjectShare.role pattern. Values: "open", "in-progress", "resolved", "closed". Default: "open".
- **D-03:** adminNotes is a single text field on BugReport, not a separate model. Admin overwrites/appends in a textarea. No comment thread needed for v5.0 scope.
- **D-04:** Required fields: description, pageUrl, submitterEmail, submitterName, browserMetadata (JSON string), status, adminNotes (nullable), createdAt, updatedAt.

### SES CDK Integration
- **D-05:** SES email identity is an individual email address (not domain). Works in sandbox mode, simplest for POC. Can upgrade to domain identity later.
- **D-06:** SES resources live in the main RequirementsFoundryStack — no separate stack. Consistent with how all other AWS resources are managed.
- **D-07:** SES sandbox limitations handled via documentation, not CDK automation. Admin email verification is a one-time manual step documented in the deploy guide (matches Okta SAML manual setup pattern).

### Environment Variable Strategy
- **D-08:** BUG_REPORT_ADMIN_EMAIL and SES_SENDER_EMAIL passed as plain CDK environment variables on the ECS container definition — not Secrets Manager or SSM. Email addresses are not sensitive.
- **D-09:** Email values are CDK context parameters (configurable via cdk.json or --context flag), not hardcoded in the stack. Allows changing admin email without editing stack code.

### Migration
- **D-10:** Migration follows existing YYYYMMDD000000 naming pattern (e.g., 20260326000000_add_bug_report). Consistent with all 4 existing migrations.
- **D-11:** Migration creates the BugReport table only — no seed data. Status is a plain string field, not a lookup table.

### Claude's Discretion
- Exact Prisma field types and annotations (e.g., @db.Text for description)
- SES CDK construct choice (L2 vs L1)
- IAM policy scope for ses:SendEmail permission
- Index strategy on BugReport table (status, createdAt, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model
- `prisma/schema.prisma` — Existing models (User, ProjectShare, Project) showing field patterns, relation style, and index conventions
- `prisma/migrations/` — Existing migration folder structure and naming convention

### Infrastructure
- `infra/lib/requirements-foundry-stack.ts` — Main CDK stack where SES resources, IAM policies, and ECS environment variables will be added
- `infra/test/requirements-foundry-stack.test.ts` — CDK test file for infrastructure assertions

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 (BugReport model) and INFRA-02 (SES configuration) are the target requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Prisma schema patterns**: User and ProjectShare models demonstrate cuid() IDs, @unique constraints, @@index annotations, and String-based enums
- **CDK stack structure**: RequirementsFoundryStack has established patterns for VPC endpoints, IAM policies, ECS task definitions, and environment variable injection
- **AwsCustomResource pattern**: Already used for Cognito client secret extraction — could inform SES custom resource if needed (but D-07 says manual)

### Established Patterns
- **Migration naming**: YYYYMMDD000000_descriptive_name (4 existing migrations)
- **Environment injection**: Plain env vars for non-sensitive config, Secrets Manager for secrets (SESSION_SECRET)
- **CDK context**: cdk.json already has context values for other configuration

### Integration Points
- **ECS task definition**: Where new environment variables (BUG_REPORT_ADMIN_EMAIL, SES_SENDER_EMAIL) will be added
- **ECS task role**: Where ses:SendEmail IAM permission will be granted
- **Prisma client**: Where BugReport model will be available after migration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for schema and SES setup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-schema-ses-infrastructure*
*Context gathered: 2026-03-26*
