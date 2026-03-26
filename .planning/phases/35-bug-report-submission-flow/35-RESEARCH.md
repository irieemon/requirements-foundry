# Phase 35: Bug Report Submission Flow - Research

**Researched:** 2026-03-26
**Domain:** Next.js server actions, AWS SES email, shadcn Dialog UI, Prisma ORM
**Confidence:** HIGH

## Summary

This phase adds a floating bug-report button to every authenticated page, a modal form to capture descriptions, and a server action that saves the report to the database and sends an HTML email notification via AWS SES. The codebase already has all the UI primitives (Dialog, Tooltip, Textarea, toast via sonner), the Prisma BugReport model (from Phase 34), and SES infrastructure (email identity + IAM permissions). The only missing dependency is `@aws-sdk/client-ses` which must be installed.

The implementation follows well-established project patterns: share-dialog.tsx demonstrates the exact Dialog + server action + toast flow, and server/actions/shares.ts shows the server action pattern with Prisma + auth. The FAB renders inside AppShell (which already receives `user` and `isAdmin` props), making user identity auto-capture trivial. SES email sending uses the standard AWS SDK v3 SendEmailCommand with fire-and-forget error handling.

**Primary recommendation:** Follow the share-dialog.tsx pattern exactly -- client component with Dialog, call a server action that does Prisma create then attempts SES send in a try/catch, return success regardless of email outcome.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Floating action button (FAB) fixed to bottom-right corner, rendered inside AppShell
- D-02: Icon-only circular button using lucide Bug icon with tooltip on hover
- D-03: Single textarea field labeled "What went wrong?" -- no severity, no category
- D-04: Page URL displayed as read-only muted hint below textarea
- D-05: Auto-captured hidden fields: pageUrl, submitterEmail, submitterName, browserMetadata (userAgent + viewport JSON)
- D-06: Modal uses existing shadcn Dialog component, consistent with share-dialog.tsx
- D-07: Rich HTML email with styled card layout, colored status badge, "View in Dashboard" button
- D-08: Email links to /bug-reports dashboard page (not specific report ID)
- D-09: Email includes submitter name/email, page URL, description, browser metadata summary, timestamp
- D-10: SES failure is fire-and-forget -- DB save first, email attempt after, success toast regardless
- D-11: Client-side 30-second cooldown after submission, no server-side rate limiting
- D-12: Description required, minimum 10 chars, empty submissions blocked client-side

### Claude's Discretion
- Email HTML template design details (colors, spacing, responsive layout)
- Server action implementation pattern (matches existing server/actions/*.ts style)
- Toast message wording and duration
- Textarea placeholder text and character limit
- browserMetadata JSON structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | Persistent "Report Bug" button on all authenticated pages | FAB renders inside AppShell component which wraps all authenticated pages. Bug icon from lucide-react already available. Tooltip component exists. |
| SUB-02 | Freeform text modal capturing page URL and user identity automatically | Dialog + Textarea components exist. UserInfo (email, name) available from AppShell user prop. window.location.pathname for URL. |
| SUB-03 | Success toast confirming submission | sonner toast library integrated via lib/toast-patterns.ts. Use toast.success() directly or appToasts.success(). |
| SUB-04 | Auto-capture browser metadata (userAgent, viewport) | Client-side: navigator.userAgent + window.innerWidth/innerHeight. Passed as JSON string to server action. |
| EMAIL-01 | Admin email notification via AWS SES | SES email identity configured in CDK. BUG_REPORT_ADMIN_EMAIL and SES_SENDER_EMAIL env vars passed to ECS container. Need to install @aws-sdk/client-ses. |
| EMAIL-02 | Rich HTML email with report details and dashboard link | Build HTML string server-side with inline styles. Link to /bug-reports page per D-08. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @aws-sdk/client-ses | 3.1017.0 | Send email via AWS SES | Official AWS SDK v3; project already uses @aws-sdk/client-s3 and @aws-sdk/client-secrets-manager at v3.100x |
| @prisma/client | 7.2.0 | Database operations (BugReport.create) | Already installed, BugReport model exists from Phase 34 |
| sonner | 2.0.7 | Toast notifications | Already installed, used throughout project via lib/toast-patterns.ts |
| lucide-react | 0.562.0 | Bug icon for FAB | Already installed, used for all icons in project |
| radix-ui Dialog | 1.4.3 | Modal component | Already installed as shadcn Dialog wrapper in components/ui/dialog.tsx |
| radix-ui Tooltip | (installed) | Hover tooltip for FAB | Already installed as components/ui/tooltip.tsx |
| zod | 4.3.5 | Server-side input validation | Already installed, standard for form validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.70.0 | Form state management | Optional -- the form is simple enough that useState may suffice, but available if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw HTML email string | react-email / @react-email/components | Adds dependency for a single email template; raw HTML with inline styles is simpler for one template |
| @aws-sdk/client-ses SendEmailCommand | @aws-sdk/client-sesv2 | SESv2 is newer but SendEmail in v1 API is sufficient; project CDK uses ses.EmailIdentity which works with both |

**Installation:**
```bash
npm install @aws-sdk/client-ses
```

## Architecture Patterns

### Recommended Project Structure
```
components/
  bug-report/
    bug-report-button.tsx    # FAB + Dialog (client component)
server/
  actions/
    bug-reports.ts           # submitBugReport server action
lib/
  email/
    bug-report-email.ts      # HTML email template builder + SES send function
```

### Pattern 1: Dialog + Server Action + Toast (share-dialog pattern)
**What:** Client component manages Dialog open/close state, collects form data, calls server action, shows toast on result.
**When to use:** Any modal form that persists data server-side.
**Example:**
```typescript
// components/bug-report/bug-report-button.tsx (follows share-dialog.tsx)
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitBugReport } from "@/server/actions/bug-reports";
import type { UserInfo } from "@/lib/auth/types";

interface BugReportButtonProps {
  user: UserInfo;
}

export function BugReportButton({ user }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleSubmit = async () => {
    if (description.trim().length < 10) return;
    setSubmitting(true);

    const result = await submitBugReport({
      description: description.trim(),
      pageUrl: window.location.pathname,
      browserMetadata: JSON.stringify({
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    });

    setSubmitting(false);
    if (result.success) {
      toast.success("Bug report submitted", { description: "Thank you for your feedback!" });
      setDescription("");
      setOpen(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
    } else {
      toast.error("Failed to submit", { description: result.error });
    }
  };

  // ... render Dialog with FAB trigger
}
```

### Pattern 2: Server Action with Fire-and-Forget Email (follows shares.ts)
**What:** Server action validates input, saves to DB first, then attempts email send in try/catch. Email failure is logged but does not affect the response.
**When to use:** When the primary operation (DB save) must succeed and a secondary operation (email) is best-effort.
**Example:**
```typescript
// server/actions/bug-reports.ts
"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sendBugReportEmail } from "@/lib/email/bug-report-email";

export async function submitBugReport(data: {
  description: string;
  pageUrl: string;
  browserMetadata: string;
}) {
  const user = await getCurrentUser(); // redirects if not authenticated

  // Validate
  if (!data.description || data.description.trim().length < 10) {
    return { success: false, error: "Description must be at least 10 characters" };
  }

  // Save to DB FIRST (D-10)
  const report = await db.bugReport.create({
    data: {
      description: data.description,
      pageUrl: data.pageUrl,
      submitterEmail: user.email,
      submitterName: user.name,
      browserMetadata: data.browserMetadata,
      status: "open",
    },
  });

  // Fire-and-forget email (D-10)
  try {
    await sendBugReportEmail(report);
  } catch (error) {
    console.error("[BugReport] Email notification failed:", error);
    // Do NOT throw -- report is saved, user gets success
  }

  return { success: true };
}
```

### Pattern 3: SES Email Sending with AWS SDK v3
**What:** Create SES client, build SendEmailCommand with HTML body, send.
**When to use:** Sending transactional emails from the application.
**Example:**
```typescript
// lib/email/bug-report-email.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function sendBugReportEmail(report: {
  description: string;
  pageUrl: string;
  submitterEmail: string;
  submitterName: string;
  browserMetadata: string;
  createdAt: Date;
}) {
  const adminEmail = process.env.BUG_REPORT_ADMIN_EMAIL;
  const senderEmail = process.env.SES_SENDER_EMAIL;

  if (!adminEmail || !senderEmail) {
    console.warn("[BugReport] Email config missing, skipping notification");
    return;
  }

  const command = new SendEmailCommand({
    Source: senderEmail,
    Destination: { ToAddresses: [adminEmail] },
    Message: {
      Subject: { Data: `Bug Report: ${report.pageUrl}`, Charset: "UTF-8" },
      Body: {
        Html: { Data: buildEmailHtml(report), Charset: "UTF-8" },
      },
    },
  });

  await ses.send(command);
}
```

### Pattern 4: FAB Placement in AppShell
**What:** The BugReportButton renders as a sibling to the main content div inside AppShell, using fixed positioning so it appears above all page content.
**When to use:** Any persistent UI element that should appear on every authenticated page.
**Example:**
```typescript
// In app-shell.tsx, add after the main content div:
<BugReportButton user={user} />
// The component itself uses: className="fixed bottom-6 right-6 z-50 ..."
```

### Anti-Patterns to Avoid
- **Awaiting email before returning success:** Email must be fire-and-forget. Never let SES latency or failure block the user response.
- **Passing raw user input into email HTML without escaping:** Description and page URL must be HTML-escaped in the email template to prevent XSS in email clients.
- **Using window.location in server components:** pageUrl and browserMetadata must be captured client-side and passed to the server action as parameters.
- **Creating the SES client per-request:** Instantiate the SESClient at module level so it reuses connections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay/portal | shadcn Dialog (components/ui/dialog.tsx) | Accessibility (focus trap, ESC close, aria), animation, already styled |
| Toast notifications | Custom notification system | sonner via lib/toast-patterns.ts | Already integrated, consistent UX, auto-dismiss |
| Tooltip | Custom hover text | shadcn Tooltip (components/ui/tooltip.tsx) | Accessibility, positioning, delay handling |
| Form textarea | Raw `<textarea>` | shadcn Textarea (components/ui/textarea.tsx) | Consistent styling with design system |
| HTML email escaping | Manual regex | Simple utility function | XSS prevention in email clients; only need to escape &, <, >, ", ' |
| Email CSS | External stylesheet | Inline styles in HTML | Email clients strip `<style>` tags; inline styles are the only reliable approach |

**Key insight:** Every UI primitive needed already exists in the project. The only new code is the bug-report-specific component, server action, and email template.

## Common Pitfalls

### Pitfall 1: SES Sandbox Mode
**What goes wrong:** Emails fail silently in production because the sender or recipient email is not verified in SES.
**Why it happens:** SES starts in sandbox mode; both sender and recipient must be verified. Phase 34 created the sender email identity in CDK, but the admin recipient must also be verified manually.
**How to avoid:** Document that BUG_REPORT_ADMIN_EMAIL must be verified in SES console (us-east-1) before emails will work. The fire-and-forget pattern (D-10) ensures the app works regardless.
**Warning signs:** `console.error("[BugReport] Email notification failed:")` logs appearing with MessageRejected errors.

### Pitfall 2: HTML Injection in Email Template
**What goes wrong:** User-submitted description containing HTML tags renders in the admin's email, potentially causing layout breakage or phishing links.
**Why it happens:** Bug description is user-controlled freeform text inserted into an HTML email template.
**How to avoid:** HTML-escape all user-provided fields (description, pageUrl, submitterName, submitterEmail) before inserting into the template.
**Warning signs:** Rendered email shows unexpected formatting or broken layout.

### Pitfall 3: Window Object Unavailable During SSR
**What goes wrong:** `window.location` or `navigator.userAgent` called during server-side rendering causes a ReferenceError.
**Why it happens:** The BugReportButton is a client component but Next.js may attempt SSR.
**How to avoid:** Access `window` only inside event handlers (handleSubmit) which only run client-side, never in the render body or useEffect without a guard.
**Warning signs:** "window is not defined" error during build or SSR.

### Pitfall 4: Missing Environment Variables in Local Dev
**What goes wrong:** Server action crashes because BUG_REPORT_ADMIN_EMAIL or SES_SENDER_EMAIL is undefined.
**Why it happens:** These env vars are set in the CDK ECS task definition but may not exist in local .env.
**How to avoid:** Guard the email send function: if env vars are missing, log a warning and skip silently. This also satisfies D-10 (fire-and-forget).
**Warning signs:** Unhandled error in submitBugReport server action.

### Pitfall 5: FAB Overlapping Page Content on Mobile
**What goes wrong:** The fixed-position FAB covers important UI elements (buttons, form fields) on small screens.
**Why it happens:** Bottom-right fixed positioning can conflict with page content, especially on mobile where screen space is limited.
**How to avoid:** Use appropriate z-index (z-50), small button size on mobile, and ensure the button doesn't overlap with the mobile navigation bar. Consider `bottom-20` on mobile to clear the MobileNav.
**Warning signs:** Users can't tap certain buttons because the FAB is on top.

## Code Examples

### HTML Email Template Builder
```typescript
// lib/email/bug-report-email.ts
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(report: {
  description: string;
  pageUrl: string;
  submitterEmail: string;
  submitterName: string;
  browserMetadata: string;
  createdAt: Date;
}): string {
  const metadata = JSON.parse(report.browserMetadata);
  const viewportStr = metadata.viewport
    ? `${metadata.viewport.width}x${metadata.viewport.height}`
    : "unknown";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden;">
    <div style="background: #dc2626; padding: 16px 24px;">
      <h1 style="color: #fff; margin: 0; font-size: 18px;">New Bug Report</h1>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 4px;"><strong>From:</strong> ${escapeHtml(report.submitterName)} (${escapeHtml(report.submitterEmail)})</p>
      <p style="margin: 0 0 4px;"><strong>Page:</strong> ${escapeHtml(report.pageUrl)}</p>
      <p style="margin: 0 0 4px;"><strong>Browser:</strong> ${escapeHtml(viewportStr)}</p>
      <p style="margin: 0 0 16px;"><strong>Time:</strong> ${report.createdAt.toISOString()}</p>
      <div style="background: #f4f4f5; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(report.description)}</p>
      </div>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/bug-reports"
         style="display: inline-block; background: #18181b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
        View in Dashboard
      </a>
    </div>
  </div>
</body>
</html>`;
}
```

### Browser Metadata Capture (Client-Side)
```typescript
// Captured in the client component before calling server action
const browserMetadata = JSON.stringify({
  userAgent: navigator.userAgent,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
  },
});
```

### Cooldown Pattern (Client-Side)
```typescript
const [cooldown, setCooldown] = useState(false);

// After successful submit:
setCooldown(true);
setTimeout(() => setCooldown(false), 30000);

// In render:
<Button disabled={cooldown || submitting}>
  {cooldown ? "Submitted" : "Submit"}
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AWS SDK v2 (aws-sdk) | AWS SDK v3 (@aws-sdk/client-ses) | 2023+ | Modular imports, tree-shakeable, smaller bundles |
| SES API v1 | SES API v2 available | 2023 | v1 SendEmail still fully supported and simpler for basic use |
| Separate email service | Server action with inline send | Next.js 14+ | Server actions eliminate the need for API routes |

**Deprecated/outdated:**
- aws-sdk v2 (the monolithic package): Use @aws-sdk/client-ses v3 instead
- API routes for form submission: Server actions are the standard Next.js pattern

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.16 |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run server/actions/__tests__/bug-reports.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | FAB visible on authenticated pages | manual | Visual check in browser | N/A |
| SUB-02 | Modal captures description + auto-fields | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Wave 0 |
| SUB-03 | Success toast after submission | manual | Visual check in browser | N/A |
| SUB-04 | Browser metadata captured | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Wave 0 |
| EMAIL-01 | SES email sent on submission | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts -x` | Wave 0 |
| EMAIL-02 | Rich HTML email with details | unit | `npx vitest run lib/email/__tests__/bug-report-email.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/actions/__tests__/bug-reports.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/actions/__tests__/bug-reports.test.ts` -- covers SUB-02, SUB-04, EMAIL-01 (server action saves to DB, calls email, handles SES failure gracefully)
- [ ] `lib/email/__tests__/bug-report-email.test.ts` -- covers EMAIL-02 (email HTML contains all required fields, HTML-escapes user input)
- [ ] Framework install: None needed -- vitest already configured

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @aws-sdk/client-ses | EMAIL-01, EMAIL-02 | Not installed | 3.1017.0 (latest) | Install via npm -- blocking for email feature |
| AWS SES (sandbox) | EMAIL-01 | Configured in CDK | -- | Fire-and-forget pattern means app works without SES |
| BUG_REPORT_ADMIN_EMAIL env var | EMAIL-01 | In ECS task def | -- | Guard with null check; skip email if missing |
| SES_SENDER_EMAIL env var | EMAIL-01 | In ECS task def | -- | Guard with null check; skip email if missing |
| Prisma BugReport model | SUB-02 | Exists in schema | -- | -- |
| shadcn Dialog | SUB-02 | Exists | -- | -- |
| shadcn Tooltip | SUB-01 | Exists | -- | -- |
| shadcn Textarea | SUB-02 | Exists | -- | -- |
| sonner | SUB-03 | 2.0.7 | -- | -- |
| lucide-react Bug icon | SUB-01 | 0.562.0 | -- | -- |

**Missing dependencies with no fallback:**
- @aws-sdk/client-ses must be installed (npm install @aws-sdk/client-ses)

**Missing dependencies with fallback:**
- BUG_REPORT_ADMIN_EMAIL / SES_SENDER_EMAIL may not exist in local .env -- email send skips gracefully

## Open Questions

1. **NEXT_PUBLIC_APP_URL for email dashboard link**
   - What we know: The email needs a link to /bug-reports. This requires the full URL (not just a path) in the email.
   - What's unclear: Whether NEXT_PUBLIC_APP_URL is already set as an env var.
   - Recommendation: Check if it exists; if not, use a fallback or make the link path-only with a note to the admin.

2. **SES Region**
   - What we know: CDK stack creates the SES email identity. The stack appears to be in us-east-1 based on STATE.md blocker note.
   - What's unclear: Whether AWS_REGION env var is set in the ECS container.
   - Recommendation: Default to "us-east-1" in the SES client if AWS_REGION is not set.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- BugReport model verified with all required fields
- `components/projects/share-dialog.tsx` -- Reference implementation for Dialog + server action + toast
- `server/actions/shares.ts` -- Server action pattern with Prisma + auth
- `components/layout/app-shell.tsx` -- FAB placement target, user prop available
- `lib/auth/index.ts` + `lib/auth/types.ts` -- getCurrentUser() returns UserInfo { sub, email, name, groups }
- `infra/lib/requirements-foundry-stack.ts` -- SES email identity, BUG_REPORT_ADMIN_EMAIL, SES_SENDER_EMAIL env vars
- `package.json` -- Verified all dependencies present except @aws-sdk/client-ses
- `vitest.config.mts` + `server/actions/__tests__/shares.test.ts` -- Test infrastructure and mocking patterns

### Secondary (MEDIUM confidence)
- npm registry: @aws-sdk/client-ses latest version is 3.1017.0 (verified 2026-03-26)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified in package.json or npm registry
- Architecture: HIGH -- follows exact patterns already in codebase (share-dialog.tsx, shares.ts)
- Pitfalls: HIGH -- based on direct codebase analysis (env vars, SES sandbox, SSR constraints)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no rapidly changing dependencies)
