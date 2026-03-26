# Architecture Research

**Domain:** Bug reporting with email notifications integration into existing Next.js + AWS app
**Researched:** 2026-03-26
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ BugReportFAB  │  │ BugReportModal│  │ Admin BugReports Page │   │
│  │ (all pages)   │  │ (dialog)      │  │ (/bug-reports)        │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘   │
│          │                  │                       │               │
├──────────┴──────────────────┴───────────────────────┴───────────────┤
│                     Server Actions Layer                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              server/actions/bug-reports.ts                    │    │
│  │  submitBugReport() | getBugReports() | updateBugStatus()     │    │
│  └────────┬──────────────────────────────┬─────────────────────┘    │
│           │                              │                          │
├───────────┴──────────────────────────────┴──────────────────────────┤
│                     Service Layer                                    │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐     │
│  │   Prisma (DB)    │  │   lib/email/ses.ts (SES client)      │     │
│  │   BugReport      │  │   sendBugReportNotification()         │     │
│  └──────────────────┘  └──────────────────────────────────────┘     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                     Infrastructure Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐       │
│  │ RDS PG   │  │ AWS SES  │  │ ECS Fargate (existing)       │       │
│  │ (exists) │  │ (NEW)    │  │ + ses:SendEmail IAM policy    │       │
│  └──────────┘  └──────────┘  └──────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New or Modified |
|-----------|----------------|-----------------|
| `BugReportFAB` | Floating action button rendered in authenticated layout, visible on all pages | **NEW** component |
| `BugReportModal` | Dialog with textarea for description, captures current URL automatically | **NEW** component |
| `server/actions/bug-reports.ts` | Server actions: submit, list, update status | **NEW** file |
| `lib/email/ses.ts` | SES email client wrapper, sends formatted bug report notification | **NEW** file |
| `app/(authenticated)/bug-reports/page.tsx` | Admin-only page listing all bug reports with status management | **NEW** page |
| `prisma/schema.prisma` | BugReport model addition | **MODIFIED** (add model) |
| `infra/lib/requirements-foundry-stack.ts` | SES identity + IAM policy for task role | **MODIFIED** (add SES permissions) |
| `app/(authenticated)/layout.tsx` | Render BugReportFAB for all authenticated users | **MODIFIED** (add FAB) |
| `components/layout/sidebar.tsx` | Add "Bug Reports" nav item for admin users | **MODIFIED** (conditional nav) |

## Recommended Project Structure

New files only (existing structure unchanged):

```
app/(authenticated)/
├── bug-reports/
│   └── page.tsx              # Admin-only bug reports dashboard
components/
├── bug-reports/
│   ├── bug-report-fab.tsx    # Floating button + modal trigger (client component)
│   ├── bug-report-modal.tsx  # Submission dialog (client component)
│   ├── bug-report-table.tsx  # Admin table with status filters
│   └── status-update.tsx     # Status dropdown for admin actions
server/actions/
├── bug-reports.ts            # Server actions for CRUD + email trigger
lib/
├── email/
│   └── ses.ts                # SES client singleton + send helper
prisma/migrations/
├── YYYYMMDD_add_bug_reports/ # Migration for BugReport model
```

### Structure Rationale

- **`components/bug-reports/`:** Follows existing pattern (components/projects/, components/subtasks/, components/layout/)
- **`server/actions/bug-reports.ts`:** Follows existing pattern (one file per domain: shares.ts, projects.ts, etc.)
- **`lib/email/ses.ts`:** New domain folder under lib/ matching lib/auth/, lib/db. Isolated because email is a cross-cutting concern potentially reused later
- **`app/(authenticated)/bug-reports/`:** Top-level route under authenticated layout, same as /projects and /runs

## Architectural Patterns

### Pattern 1: Server Action with Side Effect (Email)

**What:** The `submitBugReport` server action saves to DB then fires SES email as a non-blocking side effect. If the email fails, the bug report is still saved -- email failure should not block the user.

**When to use:** Any server action that triggers a notification as secondary effect.

**Trade-offs:** Simple, no queuing infrastructure needed. If SES is down, email is lost (acceptable for POC internal tool). For production, consider SQS dead-letter queue.

**Example:**
```typescript
"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendBugReportNotification } from "@/lib/email/ses";

export async function submitBugReport(data: { description: string; pageUrl: string }) {
  const user = await getCurrentUser();

  const report = await db.bugReport.create({
    data: {
      description: data.description,
      pageUrl: data.pageUrl,
      submitterEmail: user.email,
      submitterName: user.name || user.email,
      status: "open",
    },
  });

  // Fire-and-forget: don't block the user on email delivery
  sendBugReportNotification(report).catch((err) => {
    console.error("Failed to send bug report email:", err);
  });

  return { success: true, id: report.id };
}
```

### Pattern 2: Layout-Level Global UI (FAB)

**What:** The floating action button is rendered in the authenticated layout, making it available on every page without per-page modifications.

**When to use:** UI elements that must appear globally across all authenticated routes.

**Trade-offs:** Simple placement in layout.tsx. The FAB is a client component (needs onClick), but layout.tsx is a server component -- solved by making BugReportFAB a self-contained client component imported into the server layout.

**Example:**
```typescript
// app/(authenticated)/layout.tsx -- MODIFIED
import { BugReportFAB } from "@/components/bug-reports/bug-report-fab";

export default async function AuthenticatedLayout({ children }) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  return (
    <AppShell user={user} isAdmin={admin}>
      <main id="main-content" role="main" className="min-h-screen">
        {children}
      </main>
      <BugReportFAB userName={user.name || user.email} />
    </AppShell>
  );
}
```

### Pattern 3: Admin-Gated Page with isAdmin Check

**What:** The bug reports dashboard page checks admin status server-side and returns notFound() for non-admins, matching the existing 404-not-403 pattern.

**When to use:** Admin-only pages.

**Trade-offs:** Consistent with existing authorization patterns. Admin detection uses same `isAdmin(email)` function from `lib/auth/authorization.ts`.

**Example:**
```typescript
// app/(authenticated)/bug-reports/page.tsx
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { notFound } from "next/navigation";

export default async function BugReportsPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) notFound();

  // ... fetch and render bug reports
}
```

## Data Flow

### Bug Report Submission Flow

```
User clicks FAB (any page)
    |
    v
BugReportModal opens (client component)
    |-- Captures window.location.href automatically
    |-- User types description
    |-- Clicks Submit
    |
    v
submitBugReport() server action
    |
    +--> db.bugReport.create() --> RDS PostgreSQL
    |
    +--> sendBugReportNotification() (fire-and-forget)
              |
              v
         SES SendEmail API --> Admin email inbox
    |
    v
Return { success: true } --> Toast confirmation
```

### Admin Status Management Flow

```
Admin navigates to /bug-reports
    |
    v
Server component: isAdmin() check --> notFound() if not admin
    |
    v
db.bugReport.findMany({ orderBy: { createdAt: "desc" } })
    |
    v
Render table with status dropdowns
    |
    v
Admin selects new status --> updateBugStatus() server action
    |
    v
db.bugReport.update({ status }) --> revalidatePath("/bug-reports")
```

### Key Data Flows

1. **Submission:** Client component --> server action --> Prisma insert + SES email (parallel, email is fire-and-forget)
2. **Admin listing:** Server component --> Prisma query --> server-rendered table with client-side status dropdowns
3. **Status update:** Client event --> server action --> Prisma update --> revalidatePath

## New Database Model

```prisma
model BugReport {
  id             String   @id @default(cuid())
  description    String   @db.Text
  pageUrl        String   // URL where the bug was reported from
  submitterEmail String   // Email of the user who submitted
  submitterName  String   // Display name at time of submission
  status         String   @default("open") // open | in-progress | resolved | closed
  adminNotes     String?  @db.Text // Optional admin response/notes
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([status])
  @@index([submitterEmail])
  @@index([createdAt])
}
```

**Design decisions:**
- **No foreign key to User:** Bug reports store submitterEmail directly (like Project.userId pattern). Avoids requiring User record lookup during submission.
- **No foreign key to Project:** Bug reports are app-wide, not project-scoped. The pageUrl captures context.
- **Status as string (not enum):** Matches existing pattern (Run.status, Upload.extractionStatus). Avoids migration for status additions.
- **adminNotes field:** Allows admin to add resolution notes without a separate comments model. Keep it simple for v5.0.

## AWS SES Integration

### SES Setup Requirements

1. **Verify sender identity:** Verify a single email address (e.g., the admin email) in SES. For a POC with one admin recipient, email identity verification is sufficient -- no domain verification needed.

2. **Sandbox mode consideration:** SES starts in sandbox mode. For an internal-only tool with one verified recipient (the admin), sandbox mode works fine. Both sender and recipient must be verified in sandbox. Since the admin email is used as both sender and recipient, verifying it once covers both.

3. **IAM permissions:** Add `ses:SendEmail` and `ses:SendRawEmail` to the ECS task role.

4. **No VPC endpoint needed:** The ECS tasks run in `PRIVATE_WITH_EGRESS` subnets with NAT Gateway (confirmed in CDK stack). SES API calls go through the NAT Gateway to the public SES endpoint. This is the simplest approach and works with the existing network architecture.

### SES Client Implementation

```typescript
// lib/email/ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

const ADMIN_EMAIL = process.env.BUG_REPORT_ADMIN_EMAIL || "sean.mcinerney@merkle.com";
const FROM_EMAIL = process.env.SES_FROM_EMAIL || ADMIN_EMAIL; // In sandbox, from must be verified

export async function sendBugReportNotification(report: {
  id: string;
  description: string;
  pageUrl: string;
  submitterEmail: string;
  submitterName: string;
  createdAt: Date;
}) {
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [ADMIN_EMAIL] },
    Message: {
      Subject: { Data: `[Bug Report] New report from ${report.submitterName}` },
      Body: {
        Html: {
          Data: `<h2>New Bug Report</h2>
            <p><strong>From:</strong> ${report.submitterName} (${report.submitterEmail})</p>
            <p><strong>Page:</strong> ${report.pageUrl}</p>
            <p><strong>Time:</strong> ${report.createdAt.toISOString()}</p>
            <hr/>
            <p>${report.description.replace(/\n/g, "<br/>")}</p>`,
        },
        Text: {
          Data: `New Bug Report\n\nFrom: ${report.submitterName} (${report.submitterEmail})\nPage: ${report.pageUrl}\nTime: ${report.createdAt.toISOString()}\n\n${report.description}`,
        },
      },
    },
  });

  await ses.send(command);
}
```

### CDK Infrastructure Changes

```typescript
// In requirements-foundry-stack.ts -- ADD to taskRole policies:

// SES send email (for bug report notifications)
taskRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: ['*'], // Can scope to specific identity ARN after verification
}));

// ADD environment variable to container:
environment: {
  // ... existing vars ...
  BUG_REPORT_ADMIN_EMAIL: alarmEmail || 'sean.mcinerney@merkle.com',
},
```

**Note:** SES email identity verification is a manual one-time step (click link in verification email). CDK can create an `ses.EmailIdentity` resource to initiate it, but the human must still click the verification link. This can be done as a CDK resource or manually via AWS Console -- either works.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| AWS SES | `@aws-sdk/client-ses` SendEmailCommand from ECS task | Uses IAM task role credentials (auto-resolved via SDK credential chain). Traffic goes through NAT Gateway. |
| RDS PostgreSQL | Prisma client (existing `lib/db`) | New BugReport model, standard migration |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Layout --> BugReportFAB | Props (userName) | FAB is client component in server layout |
| BugReportModal --> server action | `submitBugReport()` call | Standard server action pattern |
| server action --> SES | Fire-and-forget async call | Email failure logged, does not fail submission |
| Sidebar --> bug-reports page | Conditional nav link | Only shown when `isAdmin` prop is true |
| bug-reports page --> server action | `getBugReports()`, `updateBugStatus()` | Admin-gated, standard Prisma queries |

### Modified Existing Files (Minimal Touchpoints)

| File | Change | Risk |
|------|--------|------|
| `prisma/schema.prisma` | Add BugReport model (append) | LOW -- additive, no existing model changes |
| `app/(authenticated)/layout.tsx` | Import and render BugReportFAB | LOW -- one line addition |
| `components/layout/sidebar.tsx` | Add conditional "Bug Reports" nav item for admins | LOW -- guarded by isAdmin |
| `infra/lib/requirements-foundry-stack.ts` | Add SES IAM policy to taskRole + env var | LOW -- additive policy statement |

## Anti-Patterns

### Anti-Pattern 1: Blocking on Email Delivery

**What people do:** `await sendEmail()` in the server action and return error to user if email fails.
**Why it's wrong:** SES can have transient failures. The bug report is the primary artifact -- the email is a notification convenience. Blocking makes submission feel slow and fragile.
**Do this instead:** Fire-and-forget with `.catch()` logging. The bug report exists in the database regardless of email delivery.

### Anti-Pattern 2: Separate API Route for Submission

**What people do:** Create `app/api/bug-reports/route.ts` with POST handler instead of a server action.
**Why it's wrong:** The existing codebase uses server actions exclusively (12 action files, zero custom API routes for mutations). An API route would break the convention.
**Do this instead:** Use `"use server"` action in `server/actions/bug-reports.ts`, matching shares.ts, projects.ts, etc.

### Anti-Pattern 3: Complex Status Machine

**What people do:** Build a full state machine with transitions, validation rules, notification on every transition, audit history.
**Why it's wrong:** This is a POC internal tool with one admin. The status field is a simple string with four values. Over-engineering wastes time.
**Do this instead:** Simple string update via server action. No transition validation beyond "must be one of four values". Add audit/history later if needed.

### Anti-Pattern 4: SQS/SNS for Email Delivery

**What people do:** Send bug report to SQS queue, have a Lambda consumer send the email for "reliability."
**Why it's wrong:** Massive over-engineering for an internal POC that sends maybe 1-5 emails per week. Adds Lambda, SQS, IAM, DLQ infrastructure for a single-recipient notification.
**Do this instead:** Direct SES call from the ECS container. If email fails, it is logged. Admin can always check the /bug-reports dashboard.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 users (current) | Direct SES from server action, single admin recipient. No changes needed. |
| 50-500 users | Consider rate limiting submissions per user (e.g., max 5/hour). Add email template in SES for consistent formatting. |
| 500+ users | Move to SQS + Lambda for email (decouple). Add multiple admin recipients. Consider assignment workflow. |

### Scaling Priorities

1. **First bottleneck:** None expected. Bug reports are low-volume writes. SES handles 1/sec in sandbox, 14/sec in production.
2. **Only real concern:** Spam/abuse -- a user submitting hundreds of reports. Mitigate with simple client-side debounce and optional server-side rate check.

## Build Order Recommendation

Based on dependency analysis:

1. **Phase 1: Schema + Server Actions** -- BugReport model, migration, CRUD server actions (no email yet)
2. **Phase 2: UI Components** -- FAB, Modal, layout integration, admin page with table
3. **Phase 3: SES Integration** -- Email client, CDK changes, wire into submit action
4. **Phase 4: Polish** -- Status filters, admin notes, toast confirmations, edge cases

**Rationale:** Schema first because everything depends on it. UI second because it can be tested with DB-only flow (no email). SES third because it requires CDK deploy and manual SES verification -- isolating it avoids blocking UI work.

## Sources

- Existing codebase analysis: `lib/auth/authorization.ts`, `server/actions/shares.ts`, `infra/lib/requirements-foundry-stack.ts`, `prisma/schema.prisma`, `app/(authenticated)/layout.tsx`, `components/layout/sidebar.tsx`
- [AWS SES SDK for JavaScript v3 - Sending Email](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples-sending-email.html)
- [Sending emails from ECS Fargate in isolated subnet](https://www.devgem.io/posts/how-to-send-emails-from-an-aws-ecs-fargate-task-in-an-isolated-subnet) -- confirms NAT Gateway approach for private subnets with egress

---
*Architecture research for: Bug reporting integration into Requirements Foundry v5.0*
*Researched: 2026-03-26*
