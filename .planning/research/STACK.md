# Stack Research: Bug Reporting with Email Notifications (v5.0)

**Domain:** Bug reporting system with email notifications and admin dashboard
**Researched:** 2026-03-26
**Confidence:** HIGH

## Key Finding: One New Dependency Required

The only new package needed is `@aws-sdk/client-sesv2` for sending email notifications via AWS SES. Everything else -- the bug report modal, admin dashboard, status management, database schema -- is built entirely with the existing stack (Prisma 7, Next.js 16, Radix UI, Zod 4, CDK).

## New Stack Addition

### AWS SES v2 SDK (Email Sending)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@aws-sdk/client-sesv2` | ^3.1015.0 | Send bug report notification emails to admin | AWS SES v2 is the current API (v1 is legacy). The app already uses `@aws-sdk/client-s3` (^3.1002.0) and `@aws-sdk/client-secrets-manager` (^3.1003.0), so this follows the established pattern of modular AWS SDK v3 imports. SES v2 provides `SendEmailCommand` with simple and raw email modes. The `^3` range will resolve to a compatible version with existing AWS SDK packages due to shared core. |

**Why SES v2 over SES v1:** The `@aws-sdk/client-ses` (v1 API) package is in maintenance mode. AWS recommends `@aws-sdk/client-sesv2` for all new integrations. The v2 API has a cleaner command interface and supports newer features like contact lists and templates.

### CDK Infrastructure Addition

| Technology | Already Installed | Purpose | Why |
|------------|-------------------|---------|-----|
| `aws-cdk-lib/aws-ses` | Yes (part of aws-cdk-lib ^2.241.0) | CDK constructs for SES email identity verification | `ses.EmailIdentity` with `ses.Identity.email()` creates and auto-verifies a sender email address. No new CDK package needed -- `aws-cdk-lib` bundles all service modules. |

## Existing Stack Usage (No Changes Needed)

These existing technologies cover all v5.0 requirements without modification:

### Database (Prisma 7.2.0)

| What | How Used in v5.0 |
|------|------------------|
| New `BugReport` model | Schema: id, userId, userEmail, description, pageUrl, status (enum), createdAt, updatedAt. Standard Prisma migration. |
| Status enum | `open`, `in-progress`, `resolved`, `closed` as string field (matching existing pattern of string enums like Run.status). |
| Relations | `BugReport` has no FK to Project -- bug reports are app-wide, tied to User only. |
| Queries | Admin dashboard: `findMany` with status filtering, ordering by createdAt. Simple CRUD -- no complex joins. |

### UI Components (Already Installed)

| Component | Package | v5.0 Usage |
|-----------|---------|------------|
| `Dialog` | `@radix-ui/react-dialog` 1.1.15 | Bug report submission modal |
| `Textarea` | Custom (already in `components/ui/textarea.tsx`) | Bug description input |
| `Button` | Custom (already in `components/ui/button.tsx`) | Submit button, floating trigger button |
| `Form` | `react-hook-form` 7.70.0 + `@hookform/resolvers` 5.2.2 | Form validation for bug report |
| `Table` | Custom (already in `components/ui/table.tsx`) | Admin bug report list |
| `StatusPill` | Custom (already in `components/ui/status-pill.tsx`) | Status display (open/in-progress/resolved/closed) |
| `Badge` | Custom (already in `components/ui/badge.tsx`) | Status badges in admin view |
| `Select` | `@radix-ui/react-select` 2.2.6 | Status change dropdown in admin dashboard |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` 2.1.16 | Actions menu on each bug report row |
| Icons | `lucide-react` 0.562.0 | Bug icon for floating button, status icons |
| Toast | `sonner` 2.0.7 | Success/error feedback on submission |

### Validation (Zod 4.3.5)

| Schema | Purpose |
|--------|---------|
| `bugReportSchema` | `{ description: z.string().min(10).max(2000), pageUrl: z.string().url() }` |
| `updateBugStatusSchema` | `{ reportId: z.string(), status: z.enum(['open', 'in-progress', 'resolved', 'closed']) }` |

### Auth (iron-session 8.0.4)

| What | How Used |
|------|----------|
| Session identity | `user.email` and `user.name` attached to bug report on submission |
| Admin check | Existing `isAdmin()` function gates the admin bug reports page -- same pattern as projects admin toggle |
| Route protection | Existing `proxy.ts` pattern protects `/admin/bug-reports` route |

### Server Actions (Next.js 16.1.1)

| Action | Pattern |
|--------|---------|
| `submitBugReport` | Server action: validate input, save to DB, send SES email, return result. Follows existing `createProject` / `shareProject` patterns. |
| `updateBugReportStatus` | Server action: admin-only, validate status transition, update DB. Follows existing admin action patterns. |
| `getBugReports` | Server component data fetching with Prisma, same as `getProjects`. |

## Installation

```bash
# One new package
npm install @aws-sdk/client-sesv2

# No other packages needed.
# Prisma migration:
npx prisma migrate dev --name add_bug_reports
```

## CDK Changes Required

```typescript
// In requirements-foundry-stack.ts, add:
import * as ses from 'aws-cdk-lib/aws-ses';

// 1. SES Email Identity (verified sender address)
const sesIdentity = new ses.EmailIdentity(this, 'BugReportSender', {
  identity: ses.Identity.email('noreply@requirementsfoundry.internal'),
  // Or use a context variable for the sender email
});

// 2. Grant ECS task role permission to send emails
taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'], // SES identities are region-wide
}));

// 3. Add environment variable to ECS task definition
// SES_SENDER_EMAIL: sender address
// ADMIN_NOTIFICATION_EMAIL: recipient (the admin)
```

**SES Sandbox Note:** New AWS accounts start in SES sandbox mode, which only allows sending to verified email addresses. For this POC internal tool, sandbox mode is acceptable -- the admin email just needs to be verified. No need to request production access unless sending to arbitrary users later.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@aws-sdk/client-sesv2` (direct) | `nodemailer` with SES transport | Nodemailer adds unnecessary abstraction. The app sends ONE type of email (bug notification) to ONE recipient (admin). Direct SES SDK call is ~15 lines of code. Nodemailer is for apps with complex email needs (templates, attachments, SMTP fallback). |
| `@aws-sdk/client-sesv2` (direct) | AWS SNS email subscription | SNS is for pub/sub fan-out. Bug report emails need structured HTML content (description, URL, user info). SNS email subscriptions send raw text with no formatting control. The existing SNS alarm topic is appropriate for simple alerts, not formatted emails. |
| SES `SendEmailCommand` (simple) | SES `SendRawEmailCommand` | Simple email mode handles subject + HTML/text body natively. Raw mode is for MIME-encoded emails with attachments, custom headers. Bug notifications don't need attachments. |
| CDK `ses.EmailIdentity` | Manual SES verification in console | CDK keeps infrastructure as code consistent with the rest of the stack. Email identity verification is a one-line CDK construct. Manual console steps break the IaC pattern. |
| String status field | Prisma enum type | The existing codebase uses string fields for statuses (Run.status, Upload.extractionStatus) with TypeScript type unions for type safety. Only RunStoryStatus uses a Prisma enum. Follow the dominant pattern (string field) for consistency. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `nodemailer` | Overkill for single-recipient notification emails. Adds a dependency with SMTP transport complexity the app doesn't need. | Direct `@aws-sdk/client-sesv2` `SendEmailCommand` |
| `react-email` / `@react-email/components` | Email template library for complex transactional emails. This app sends ONE email type with 4 fields. A template string is sufficient. | Inline HTML template string in the server action |
| `bull` / `bullmq` / any queue library | Email sending should NOT be async-queued. SES API calls complete in <200ms. The existing pattern is synchronous server actions. Adding a queue for one email per bug report is massive over-engineering. | Call SES directly in the server action. If it fails, catch the error and still save the bug report (email is nice-to-have, not critical). |
| Separate email microservice / Lambda | One email type, one recipient, called from one place. A Lambda adds deployment complexity, cold start latency, and IAM complexity for zero benefit. | Send from the ECS application directly via AWS SDK |
| `@tanstack/react-table` | The admin bug report list is a simple table with ~5 columns and no complex sorting/filtering/pagination needs (internal tool, likely <100 reports). The existing `components/ui/table.tsx` handles this. | Existing table component with manual sorting if needed |
| WebSocket for real-time bug report updates | Admin checks the dashboard manually. No requirement for push notifications to the admin page. The app's established pattern is polling or page refresh. | Standard page load data fetching |

## Schema Design

```prisma
model BugReport {
  id          String   @id @default(cuid())
  userId      String   // User.id of submitter
  userEmail   String   // email for display (denormalized for convenience)
  userName    String?  // display name at time of submission
  description String   @db.Text  // freeform bug description
  pageUrl     String   // URL where the bug was reported from
  status      String   @default("open")  // open | in-progress | resolved | closed
  adminNotes  String?  @db.Text  // optional admin response/notes
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status])
  @@index([userId])
  @@index([createdAt])
}
```

**Design rationale:**
- `userId` + `userEmail` denormalized: userId for FK integrity with User table, email for display without joins (matches existing patterns)
- `@db.Text` on description and adminNotes: PostgreSQL TEXT type for unlimited length
- No relation to Project: bug reports are about the app itself, not project-specific
- `adminNotes` field: allows admin to add context when changing status, useful for tracking
- Status as string (not Prisma enum): follows dominant codebase pattern (Run.status, Upload.status use strings)

## Email Template Pattern

```typescript
// lib/email/bug-report-notification.ts
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({ region: process.env.AWS_REGION || 'us-east-1' });

export async function sendBugReportNotification(report: {
  userEmail: string;
  userName: string | null;
  description: string;
  pageUrl: string;
  createdAt: Date;
}) {
  const command = new SendEmailCommand({
    FromEmailAddress: process.env.SES_SENDER_EMAIL,
    Destination: {
      ToAddresses: [process.env.ADMIN_NOTIFICATION_EMAIL!],
    },
    Content: {
      Simple: {
        Subject: { Data: `[Bug Report] New report from ${report.userName || report.userEmail}` },
        Body: {
          Html: { Data: buildHtmlEmail(report) },
          Text: { Data: buildTextEmail(report) },
        },
      },
    },
  });
  await ses.send(command);
}
```

**Pattern notes:**
- SES client instantiated once at module level (reused across requests in ECS)
- Both HTML and plain text body for email client compatibility
- Sender and recipient addresses from environment variables (set in CDK)
- No retry logic needed: SES accepts the email or throws immediately. If SES is down, the bug report is still saved to DB.

## Version Compatibility

| Package | Current Version | v5.0 Addition | Compatible | Notes |
|---------|----------------|---------------|------------|-------|
| `@aws-sdk/client-sesv2` | NEW | ^3.1015.0 | Yes | Shares `@smithy/*` core with existing `@aws-sdk/client-s3` ^3.1002.0. npm deduplicates shared dependencies. |
| `@aws-sdk/client-s3` | ^3.1002.0 | No change | Yes | Already installed, validates SDK v3 pattern works in this environment |
| `aws-cdk-lib` | ^2.241.0 | `aws-cdk-lib/aws-ses` (already bundled) | Yes | No CDK version change needed. SES constructs stable since CDK v2.0. |
| `@prisma/client` | ^7.2.0 | New migration only | Yes | Standard `migrate dev` for new table |
| `react-hook-form` | ^7.70.0 | Bug report form | Yes | Same pattern as existing forms |
| `zod` | ^4.3.5 | Validation schemas | Yes | Same pattern as existing validation |

## SES Operational Considerations

| Concern | Detail |
|---------|--------|
| **Sandbox mode** | Acceptable for POC. Admin email must be verified in SES console (or via CDK EmailIdentity). Sends only to verified addresses. |
| **Production access** | Only needed if sending to non-verified addresses. For bug reports (admin-only recipient), sandbox is fine permanently. |
| **Region** | Use us-east-1 (same as all other AWS resources). SES is available in us-east-1. |
| **Cost** | $0.10 per 1,000 emails. Bug reports will be single-digit per week. Effectively free. |
| **Rate limits** | Sandbox: 1 email/second, 200/day. Production: much higher. Neither limit matters for bug report volume. |
| **Bounce handling** | Not needed. Sending to a single known admin address. No mailing list concerns. |
| **DKIM/SPF** | Not needed for email identity (single address). Only relevant for domain identities. Verification email is sent to the address. |

## Sources

- [@aws-sdk/client-sesv2 npm](https://www.npmjs.com/package/@aws-sdk/client-sesv2) -- latest version 3.1015.0, verified 2026-03-26
- [AWS SES v2 JavaScript SDK docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/sesv2/) -- SendEmailCommand API reference
- [CDK EmailIdentity construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ses.EmailIdentity.html) -- CDK v2 SES identity creation
- [SES sandbox docs](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) -- sandbox limitations and production access process
- Existing codebase: `package.json`, `prisma/schema.prisma`, `infra/lib/requirements-foundry-stack.ts`, `components/ui/*.tsx` -- verified all existing components and patterns

---
*Stack research for: Requirements Foundry v5.0 Bug Reporting*
*Researched: 2026-03-26*
