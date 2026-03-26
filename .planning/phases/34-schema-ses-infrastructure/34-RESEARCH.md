# Phase 34: Schema & SES Infrastructure - Research

**Researched:** 2026-03-26
**Domain:** Prisma schema migration + AWS CDK SES email infrastructure
**Confidence:** HIGH

## Summary

This phase adds two independent pieces of infrastructure: a BugReport table via Prisma migration and AWS SES email delivery configuration via CDK. Both are well-understood, low-risk additions that follow established patterns already present in the codebase.

The BugReport Prisma model is a standalone table with no foreign keys to existing models (per D-01). It follows the exact same patterns as User and ProjectShare -- cuid() IDs, String-based status fields, `@default(now())` timestamps. The migration is a single CREATE TABLE with indexes.

The SES CDK addition is minimal: one `ses.EmailIdentity` resource for an individual email address, one IAM policy statement on the existing task role for `ses:SendEmail`, and two new environment variables on the existing ECS container definition. The CDK stack already has the exact patterns for all three operations (see `taskRole.addToPolicy`, `environment: {}` block on AppContainer, and `this.node.tryGetContext` for configurable values).

**Primary recommendation:** Follow existing codebase patterns exactly. No new libraries, no new constructs, no architectural changes. This is pure additive work.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** BugReport is project-independent -- no FK to Project or User. Stores submitterEmail and submitterName directly as strings.
- **D-02:** Status stored as a String field (not Prisma enum), matching ProjectShare.role pattern. Values: "open", "in-progress", "resolved", "closed". Default: "open".
- **D-03:** adminNotes is a single text field on BugReport, not a separate model. Admin overwrites/appends in a textarea.
- **D-04:** Required fields: description, pageUrl, submitterEmail, submitterName, browserMetadata (JSON string), status, adminNotes (nullable), createdAt, updatedAt.
- **D-05:** SES email identity is an individual email address (not domain). Works in sandbox mode.
- **D-06:** SES resources live in the main RequirementsFoundryStack -- no separate stack.
- **D-07:** SES sandbox limitations handled via documentation, not CDK automation. Admin email verification is a manual step.
- **D-08:** BUG_REPORT_ADMIN_EMAIL and SES_SENDER_EMAIL passed as plain CDK environment variables on the ECS container definition.
- **D-09:** Email values are CDK context parameters (configurable via cdk.json or --context flag).
- **D-10:** Migration follows existing YYYYMMDD000000 naming pattern (e.g., 20260326000000_add_bug_report).
- **D-11:** Migration creates BugReport table only -- no seed data.

### Claude's Discretion
- Exact Prisma field types and annotations (e.g., @db.Text for description)
- SES CDK construct choice (L2 vs L1)
- IAM policy scope for ses:SendEmail permission
- Index strategy on BugReport table (status, createdAt, etc.)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | BugReport model exists in the database with all required fields (description, page URL, submitter, browser metadata, status, notes, timestamps) | Prisma schema patterns fully documented; migration SQL convention established from 4 existing migrations; field types map directly to existing patterns (String, @db.Text, DateTime) |
| INFRA-02 | AWS SES is configured in CDK with email identity verification and ECS task role permissions | CDK stack patterns for IAM policy, environment variables, and context parameters fully mapped; SES L2 construct (`ses.EmailIdentity`) available in aws-cdk-lib@2.241.0 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma | ^7.2.0 | Schema definition and migration generation | Already in use; all 4 existing migrations use this |
| aws-cdk-lib | 2.241.0 | CDK infrastructure definitions including SES | Already installed in infra/; all infrastructure defined here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aws-cdk-lib/aws-ses | 2.241.0 (bundled) | SES email identity L2 construct | For creating the email identity resource |
| aws-cdk-lib/aws-iam | 2.241.0 (bundled) | IAM policy statement for ses:SendEmail | For granting task role SES permissions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ses.EmailIdentity (L2) | CfnEmailIdentity (L1) | L2 is cleaner and has grant helpers; L1 offers no advantage here |
| Plain env vars | SSM Parameter Store | Unnecessary complexity for non-sensitive email addresses (D-08 locks this) |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
No new files or directories beyond:
```
prisma/
  schema.prisma                              # Add BugReport model
  migrations/
    20260326000000_add_bug_report/
      migration.sql                          # Generated by prisma migrate dev

infra/
  lib/requirements-foundry-stack.ts          # Add SES identity, IAM policy, env vars
  test/requirements-foundry-stack.test.ts    # Add SES-related CDK assertions
  cdk.json                                   # Add context defaults for email addresses
```

### Pattern 1: Prisma Model (follows User/ProjectShare pattern)
**What:** Standalone model with cuid() ID, String status, DateTime timestamps
**When to use:** For all new tables in this project
**Example:**
```prisma
// Source: prisma/schema.prisma (existing User model pattern)
model BugReport {
  id               String   @id @default(cuid())
  description      String   @db.Text
  pageUrl          String
  submitterEmail   String
  submitterName    String
  browserMetadata  String   @db.Text    // JSON string
  status           String   @default("open")  // "open" | "in-progress" | "resolved" | "closed"
  adminNotes       String?  @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

**Field type rationale (Claude's discretion items):**
- `description @db.Text` -- bug descriptions can be lengthy; @db.Text maps to PostgreSQL TEXT (unbounded) vs VARCHAR(191) default
- `pageUrl String` -- URLs are short enough for default VARCHAR; no @db.Text needed
- `browserMetadata @db.Text` -- JSON string containing userAgent (can be 200+ chars), viewport, etc.
- `adminNotes? @db.Text` -- nullable, free-form admin notes
- `submitterEmail String` and `submitterName String` -- standard length, no @db.Text needed

**Index strategy rationale (Claude's discretion item):**
- `@@index([status])` -- ADMIN-04 requires filtering by status; index supports WHERE status = 'open' queries
- `@@index([createdAt])` -- ADMIN-04 requires sorting by date; ADMIN-05 requires counting open reports (compound with status)
- No compound index needed yet -- single-column indexes are sufficient for the admin dashboard query patterns in scope

### Pattern 2: CDK Context Parameters (follows oktaMetadataUrl pattern)
**What:** Configurable values via `this.node.tryGetContext()` with optional defaults
**When to use:** For deployment-specific configuration that is not sensitive
**Example:**
```typescript
// Source: infra/lib/requirements-foundry-stack.ts line 361 (existing pattern)
const bugReportAdminEmail = this.node.tryGetContext('bugReportAdminEmail');
const sesSenderEmail = this.node.tryGetContext('sesSenderEmail');
```

### Pattern 3: IAM Policy on Task Role (follows Bedrock pattern)
**What:** Add PolicyStatement to existing taskRole
**When to use:** When ECS task needs new AWS service permissions
**Example:**
```typescript
// Source: infra/lib/requirements-foundry-stack.ts lines 272-275 (existing Bedrock pattern)
taskRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'],  // or scope to specific identity ARN
}));
```

**IAM scope rationale (Claude's discretion item):**
- Option A: `resources: ['*']` -- matches existing Bedrock pattern in the stack, simplest
- Option B: `resources: [emailIdentity.emailIdentityArn]` -- more secure, scopes to the specific identity
- **Recommendation:** Use the email identity ARN for the resource constraint. SES is different from Bedrock -- we know the exact identity at deploy time. This follows least-privilege while adding minimal complexity.

### Pattern 4: ECS Container Environment Variables (follows existing block)
**What:** Add key-value pairs to the `environment: {}` block in addContainer
**When to use:** For non-sensitive configuration values
**Example:**
```typescript
// Source: infra/lib/requirements-foundry-stack.ts lines 481-491 (existing pattern)
environment: {
  // ... existing vars ...
  BUG_REPORT_ADMIN_EMAIL: bugReportAdminEmail,
  SES_SENDER_EMAIL: sesSenderEmail,
},
```

### Pattern 5: SES Email Identity (L2 construct)
**What:** Create an SES email identity for a specific email address
**When to use:** For email sending capability in sandbox mode
**Example:**
```typescript
import * as ses from 'aws-cdk-lib/aws-ses';

const emailIdentity = new ses.EmailIdentity(this, 'SesEmailIdentity', {
  identity: ses.Identity.email(sesSenderEmail),
});
```

**SES construct rationale (Claude's discretion item):**
- L2 `ses.EmailIdentity` is available in aws-cdk-lib@2.241.0
- It creates `AWS::SES::EmailIdentity` under the hood
- Provides `.emailIdentityArn` property for IAM scoping
- No grant helper for send permissions exists on EmailIdentity, so `taskRole.addToPolicy` is needed regardless

### Anti-Patterns to Avoid
- **Adding FK to User or Project on BugReport:** D-01 explicitly prohibits this. Bug reports are app-level, not project-scoped.
- **Using Prisma enum for status:** D-02 locks String type, matching ProjectShare.role pattern.
- **Creating separate CDK stack for SES:** D-06 locks everything in RequirementsFoundryStack.
- **Hardcoding email addresses in stack code:** D-09 requires CDK context parameters.
- **Automating SES sandbox exit or verification:** D-07 says manual documentation only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migration SQL | Write raw SQL manually | `prisma migrate dev --name add_bug_report` | Prisma generates correct SQL with proper types, indexes, and constraints |
| SES CloudFormation resource | CfnEmailIdentity (L1) | `ses.EmailIdentity` (L2) | L2 provides ARN property, cleaner API |
| Email address validation | Custom regex | CDK context + SES verification flow | SES handles email format validation during identity verification |

## Common Pitfalls

### Pitfall 1: SES Sandbox Mode Restrictions
**What goes wrong:** SES in sandbox mode only allows sending TO verified email addresses. Deploying the CDK stack creates the identity but does not verify it. Verification requires clicking a link in a confirmation email sent by AWS to the address.
**Why it happens:** SES sandbox is the default for new accounts/regions. Production access requires a separate AWS support request.
**How to avoid:** Document the manual verification step clearly. The sender email AND the admin recipient email must both be verified in sandbox mode (unless production access is granted).
**Warning signs:** `MessageRejected: Email address is not verified` error at runtime.

### Pitfall 2: SES Region Mismatch
**What goes wrong:** SES identity created in one region but application sends from another.
**Why it happens:** SES is regional. The CDK stack deploys to us-east-1 (matching the stack env), but if the application code uses a different region for the SES client, sending fails.
**How to avoid:** Ensure the application code uses `us-east-1` for SES API calls (already set as AWS_REGION env var on the container).
**Warning signs:** `MessageRejected: Identity not found` or `AccessDenied` despite correct IAM policy.

### Pitfall 3: Prisma Migration Drift
**What goes wrong:** Running `prisma migrate dev` locally creates migration but schema.prisma changes are not in sync with what was deployed.
**Why it happens:** Prisma migrate dev is designed for development databases. Production uses `prisma migrate deploy`.
**How to avoid:** Generate migration locally with `prisma migrate dev --name add_bug_report`, commit both schema.prisma changes AND the generated migration SQL. Production deployment uses `prisma migrate deploy` which runs the SQL files.
**Warning signs:** `prisma migrate deploy` fails with "migration already applied" or schema drift errors.

### Pitfall 4: CDK Test Context Missing New Parameters
**What goes wrong:** CDK tests fail because the test App context does not include new context parameters (bugReportAdminEmail, sesSenderEmail).
**Why it happens:** The test file creates an App with specific context values (see line 10-12 of test file). New context parameters may be required for stack synthesis.
**How to avoid:** Add test values for new context parameters in the `beforeAll` block. If using `tryGetContext` (which returns undefined for missing keys), ensure the stack handles undefined gracefully -- either with defaults or conditional resource creation.
**Warning signs:** CDK synth fails during test with "Cannot read property of undefined" or resources not created in test template.

### Pitfall 5: Environment Variable Available but Empty
**What goes wrong:** ECS container starts with BUG_REPORT_ADMIN_EMAIL or SES_SENDER_EMAIL as empty string or undefined.
**Why it happens:** CDK context parameter not provided during deploy, and no default value set.
**How to avoid:** Either require the context values (throw during synth if missing, like oktaMetadataUrl pattern) or provide sensible defaults. Given D-09 says "configurable", using tryGetContext with no default and a guard clause is the pattern to follow -- but document clearly that deploy requires `--context bugReportAdminEmail=x --context sesSenderEmail=y`.
**Warning signs:** Application sends email with empty From/To, resulting in SES API error.

## Code Examples

### BugReport Prisma Model (complete)
```prisma
// Source: follows prisma/schema.prisma User/ProjectShare patterns
// ============================================
// Bug Reports (app-level feedback, not project-scoped)
// ============================================

model BugReport {
  id               String   @id @default(cuid())
  description      String   @db.Text
  pageUrl          String
  submitterEmail   String
  submitterName    String
  browserMetadata  String   @db.Text
  status           String   @default("open")
  adminNotes       String?  @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
}
```

### CDK SES Integration (complete)
```typescript
// Source: follows existing patterns in infra/lib/requirements-foundry-stack.ts
import * as ses from 'aws-cdk-lib/aws-ses';

// Context parameters (place near other tryGetContext calls, ~line 521)
const bugReportAdminEmail = this.node.tryGetContext('bugReportAdminEmail');
const sesSenderEmail = this.node.tryGetContext('sesSenderEmail');

// SES Email Identity (place after Cognito section, before Container section)
const sesEmailIdentity = new ses.EmailIdentity(this, 'SesEmailIdentity', {
  identity: ses.Identity.email(sesSenderEmail),
});

// IAM policy for SES on task role (place with other taskRole.addToPolicy calls, ~line 290)
taskRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: [sesEmailIdentity.emailIdentityArn],
}));

// Environment variables (add to existing environment block in addContainer, ~line 490)
// BUG_REPORT_ADMIN_EMAIL: bugReportAdminEmail,
// SES_SENDER_EMAIL: sesSenderEmail,
```

### CDK Test Assertions (SES)
```typescript
// Source: follows patterns in infra/test/requirements-foundry-stack.test.ts
describe('SES Infrastructure', () => {
  test('SES email identity exists', () => {
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: Match.anyValue(),
    });
  });

  test('Task role has ses:SendEmail permission', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['ses:SendEmail']),
          }),
        ]),
      }),
    });
  });

  test('ECS container includes BUG_REPORT_ADMIN_EMAIL environment variable', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            Match.objectLike({ Name: 'BUG_REPORT_ADMIN_EMAIL' }),
          ]),
        }),
      ]),
    });
  });

  test('ECS container includes SES_SENDER_EMAIL environment variable', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            Match.objectLike({ Name: 'SES_SENDER_EMAIL' }),
          ]),
        }),
      ]),
    });
  });
});
```

### Migration SQL (expected output from prisma migrate dev)
```sql
-- CreateTable: BugReport
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "browserMetadata" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BugReport.status
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex: BugReport.createdAt
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via aws-cdk-lib/assertions) |
| Config file | `infra/jest.config.js` (CDK default) |
| Quick run command | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` |
| Full suite command | `cd infra && npx jest` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | BugReport table exists with correct schema | unit (Prisma migration) | `npx prisma validate` (schema check only) | N/A - migration generated |
| INFRA-02a | SES email identity resource exists in stack | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "SES"` | Wave 0 |
| INFRA-02b | Task role has ses:SendEmail permission | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "ses:SendEmail"` | Wave 0 |
| INFRA-02c | ECS container has BUG_REPORT_ADMIN_EMAIL env var | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "BUG_REPORT_ADMIN_EMAIL"` | Wave 0 |
| INFRA-02d | ECS container has SES_SENDER_EMAIL env var | unit (CDK assertion) | `cd infra && npx jest --testPathPattern=requirements-foundry-stack -t "SES_SENDER_EMAIL"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd infra && npx jest --testPathPattern=requirements-foundry-stack`
- **Per wave merge:** `cd infra && npx jest && npx prisma validate`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] SES test assertions in `infra/test/requirements-foundry-stack.test.ts` -- covers INFRA-02a through INFRA-02d
- [ ] Test context values for `bugReportAdminEmail` and `sesSenderEmail` in test `beforeAll` block

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- existing model patterns (User, ProjectShare, Upload)
- `prisma/migrations/20260323000000_add_user_and_shares/migration.sql` -- migration SQL convention
- `infra/lib/requirements-foundry-stack.ts` -- CDK stack patterns for IAM, env vars, context params
- `infra/test/requirements-foundry-stack.test.ts` -- CDK test assertion patterns
- `infra/cdk.json` -- existing context configuration
- `infra/package.json` -- aws-cdk-lib@2.241.0 confirmed installed

### Secondary (MEDIUM confidence)
- AWS CDK SES module -- `ses.EmailIdentity` L2 construct available since CDK v2.x; `emailIdentityArn` property confirmed in CDK docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use; no new dependencies
- Architecture: HIGH -- every pattern has a direct precedent in the existing codebase
- Pitfalls: HIGH -- SES sandbox behavior is well-documented; Prisma migration workflow is established

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no fast-moving dependencies)
