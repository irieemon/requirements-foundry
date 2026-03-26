# Feature Research

**Domain:** In-app bug reporting system for internal enterprise web app
**Researched:** 2026-03-26
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = the bug reporting system feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Floating "Report Bug" button | Users need a persistent, discoverable entry point on every page. Without it, they revert to email/Slack and reports get lost. | LOW | Fixed-position button in lower-left corner. Renders inside `AppShell` so it appears on all authenticated pages. Use lucide `Bug` icon. |
| Modal form with description field | A lightweight modal is the standard UX pattern -- no page navigation, no context loss. Freeform textarea is the minimum viable input. | LOW | Use existing `dialog.tsx` component. Single `textarea` field + submit button. Keep it minimal -- internal users, not public. |
| Automatic page URL capture | Users should not have to explain where they were. The system captures `window.location.href` automatically. | LOW | Read `window.location.href` on modal open, send with submission. Zero user effort. |
| Automatic submitter identification | The system knows who is logged in. Requiring users to identify themselves is friction for no reason. | LOW | `UserInfo` already in session via AppShell props. Pass `user.email` and `user.name` from context. No extra DB lookup needed. |
| Timestamp on submission | Basic auditability. Every report needs a creation time. | LOW | Prisma `@default(now())` on `createdAt` field. Standard pattern already used throughout the schema. |
| Success confirmation after submit | Users need to know their report was received. Without feedback, they will submit duplicates or lose trust. | LOW | Toast notification via existing `sonner.tsx`. "Bug report submitted -- thank you." Close modal on success. |
| Email notification to admin on submission | The admin (single hardcoded email) needs to know immediately when a bug is reported, not discover it hours later by checking a dashboard. | MEDIUM | AWS SES `SendEmailCommand` via `@aws-sdk/client-ses`. The app already runs on ECS with IAM task roles, so SES access requires only an IAM policy addition. Requires SES identity verification (domain or email) and possibly production access request if still in sandbox. |
| Admin-only bug reports page | Admin needs a dedicated place to see all reports, not scattered across other views. List view with status, submitter, date, description preview. | MEDIUM | New route `/bug-reports` visible only to admin. Use existing `isAdmin()` check from `lib/auth/authorization.ts`. Use existing `table.tsx` component for the list. Add "Bug Reports" nav item to sidebar gated by `isAdmin` prop. |
| Status workflow (open/in-progress/resolved/closed) | Admin needs to track what has been acknowledged, what is being worked on, and what is done. Without status, the list becomes an undifferentiated pile. | LOW | String column on BugReport model with four valid values. Status transitions via server action. Use existing `status-pill.tsx` for visual display. No complex state machine needed -- any status can transition to any other. |
| Status update by admin | Admin needs to change status as they triage and resolve. Inline dropdown or detail view action. | LOW | Server action `updateBugReportStatus`. Dropdown select on the admin list row or a detail panel. Only admin can invoke. |

### Differentiators (Competitive Advantage)

Features that make the bug reporting experience notably better than "email the admin." Not required for launch, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Browser/viewport metadata capture | Helps admin reproduce bugs without asking follow-up questions. Captures browser name, version, viewport size, OS automatically. | LOW | Read `navigator.userAgent` and `window.innerWidth/Height` on modal open. Store as JSON in a `metadata` column. No user action required. |
| Admin notes on reports | Admin can add internal notes to a report (e.g., "Reproduced -- Prisma timeout on large projects"). Creates a paper trail without a full ticketing system. | MEDIUM | A `BugReportNote` model with text, authorEmail, timestamp. Simple list of notes on the report detail view. Admin-only write access. |
| Filter/sort on admin dashboard | As reports accumulate, admin needs to filter by status and sort by date. Without it, the list becomes unusable past ~20 reports. | LOW | Query params for status filter, sort by date. Use existing `table-toolbar.tsx` pattern from runs/projects pages. |
| Open report count badge in sidebar | Admin sees at a glance how many open reports exist without navigating to the page. Creates urgency for new reports. | LOW | Query count of `status = 'OPEN'` reports. Display badge on the "Bug Reports" sidebar nav item. Small server-side query on layout render. |
| Rich email with report details | The notification email contains the full description, submitter name, page URL, and a direct link to the admin dashboard -- not just "a new bug was reported." | LOW | HTML email body with report details inline. Admin can triage from inbox without opening the app first. Plain text fallback for accessibility. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific context (internal enterprise tool, single admin, small user base).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Screenshot/screen capture in reports | "A picture is worth a thousand words." | Adds significant complexity: canvas API or browser screenshot API, blob storage in S3, upload handling, preview rendering, file size limits. For an internal tool with one admin who can reproduce issues directly, the page URL + description is sufficient. Over-engineering for the user count. | Users paste screenshots in Teams/Slack alongside the in-app report. Add a note in the modal: "For screenshots, share in Teams." |
| Priority/severity selection by reporter | "Let users indicate how urgent it is." | Users over-prioritize everything as "critical." With a single admin triaging a small internal app, every report gets seen quickly. Adding priority fields adds form friction without adding real signal. | Admin assesses severity themselves during triage. If needed later, admin can add a priority column to their own view. |
| Real-time updates (WebSocket) for admin dashboard | "Admin should see new reports instantly." | The app uses polling architecture throughout (runs, progress tracking). Adding WebSockets for one feature creates architectural inconsistency and ECS deployment complexity (sticky sessions, ALB WebSocket config). | Manual page refresh. Or add a polling interval (30s) on the admin page using existing `useEffect` + `setInterval` pattern already established for run progress. |
| Reporter can track their own reports | "Users should see what happened to their bugs." | Creates a new user-facing page, notification system for status changes, and expectations around admin response time. For an internal tool where the admin is one person who sits on the same team, this is overhead. | Admin replies to the reporter via email/Teams when a bug is resolved. Keep the system one-directional for v5.0. |
| File/attachment uploads on reports | "Users should attach logs, exports, etc." | Requires S3 upload flow, file type validation, size limits, preview rendering, and storage cleanup. The bug report is for quick feedback, not a support ticket system. | If detailed artifacts are needed, the admin requests them via email/Teams. Keep the form to a single text field. |
| Full ticketing system (assignment, due dates, labels, sprints) | "We should build a proper issue tracker." | JIRA/Linear/GitHub Issues already exist and do this infinitely better. Building even a subset of an issue tracker creates ongoing maintenance for a feature that will never match purpose-built tools. | The bug report feature is a lightweight intake funnel. If a report needs tracked work, the admin creates a JIRA ticket manually. |
| Email notifications to all users on status change | "Notify the reporter when their bug is fixed." | Requires SES sends to arbitrary user addresses (not just one admin), unsubscribe handling, email preferences, and creates expectation of bidirectional communication. Scope explosion. | Defer entirely. Admin contacts reporters directly via Teams/email for important updates. |

## Feature Dependencies

```
[BugReport Prisma model + migration]
    |
    +--required by--> [Floating button + modal form]  (submitter UI)
    |                     |
    |                     +--required by--> [AppShell integration]  (renders on all pages)
    |
    +--required by--> [Server action: createBugReport]  (validate + save to DB)
    |                     |
    |                     +--triggers--> [SES email notification]  (async, after DB write)
    |
    +--required by--> [Admin bug reports page]  (read from DB)
                          |
                          +--required by--> [Sidebar nav item]  (admin-only, gated by isAdmin)
                          |
                          +--required by--> [Server action: updateBugReportStatus]
```

### Dependency Notes

- **BugReport model is the foundation:** Everything depends on the Prisma model and migration. Must be the first thing built. No existing table to extend -- this is a new model.
- **Floating button + modal require AppShell:** The button renders inside `AppShell`, which already receives `user` and `isAdmin` props. No new context providers or layout changes needed -- just a new child component.
- **SES email is triggered by createBugReport but must not block it:** The email send happens inside the server action after the DB write succeeds. If SES fails, the report is still saved. Log the SES error, do not surface it to the user. This means SES setup (CDK infra) must be done before the server action is fully functional.
- **Admin page is independent of the submission flow:** Can be built in parallel with the floating button. Both depend only on the BugReport model.
- **Status update does not trigger email in v5.0:** Status changes are admin-only operations with no downstream side effects. Simple DB update.
- **CDK changes (SES identity + IAM policy) are a prerequisite for email:** Must be deployed before the email notification works. Can be a separate phase/plan that runs first.

## Existing Dependencies (Already Built)

These features are already implemented and will be reused directly -- no new code needed for these capabilities.

| Existing Feature | How Bug Reporting Uses It |
|------------------|--------------------------|
| `AppShell` component (`components/layout/app-shell.tsx`) | Wraps all authenticated pages; renders the floating bug report button as a child |
| `UserInfo` in session (`lib/auth/types.ts`) | Provides submitter email and name without extra DB lookup |
| `isAdmin()` function (`lib/auth/authorization.ts`) | Gates the admin-only bug reports page and sidebar nav item |
| `dialog.tsx` component | Modal wrapper for the bug report form |
| `textarea.tsx` component | Description input field in the modal |
| `button.tsx` component | Submit button, floating trigger button, status change controls |
| `table.tsx` component | Admin bug reports list layout |
| `status-pill.tsx` component | Visual status display (open/in-progress/resolved/closed) |
| `sonner.tsx` toast notifications | Success/error feedback after submission |
| `Sidebar` component (`components/layout/sidebar.tsx`) | Add admin-only "Bug Reports" nav link (pattern: check `isAdmin` prop) |
| Prisma + RDS PostgreSQL | Store BugReport model via standard migration |
| ECS Fargate IAM task role | Authorize SES API calls -- add `ses:SendEmail` permission to existing role |
| CDK infrastructure (`infra/lib/`) | Add SES email identity verification and IAM policy statement |
| `User` model (`prisma/schema.prisma`) | Link bug reports to submitter via `userId` FK (User table already exists from v4.0) |

## MVP Definition

### Launch With (v5.0)

Minimum viable bug reporting -- the complete feedback loop from user submission to admin management.

- [ ] **BugReport Prisma model** -- description (text), pageUrl (string), submitterEmail (string), submitterName (string), status (string, default "OPEN"), createdAt, updatedAt
- [ ] **Floating "Report Bug" button** -- fixed-position lower-left button on all authenticated pages via AppShell
- [ ] **Modal form** -- freeform description textarea, auto-captured page URL and user info, submit button
- [ ] **Server action: createBugReport** -- validates description is non-empty, saves to DB, triggers SES email
- [ ] **SES email notification** -- sends report details (description, submitter, URL) to admin email on submission
- [ ] **SES CDK infrastructure** -- email identity verification, IAM policy for `ses:SendEmail` on ECS task role
- [ ] **Admin bug reports page** -- table view with all reports showing status, submitter, date, description preview, page URL
- [ ] **Status workflow** -- admin can update status via dropdown (OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED, any-to-any transitions)
- [ ] **Sidebar nav item** -- admin-only "Bug Reports" link, gated by `isAdmin` prop, using lucide `Bug` icon
- [ ] **Success toast** -- confirmation after submission via sonner

### Add After Validation (v5.x)

Features to add once the core reporting loop is working and getting real usage.

- [ ] **Browser metadata capture** -- auto-collect userAgent, viewport dimensions, OS with each report
- [ ] **Admin notes on reports** -- internal notes model attached to reports for investigation tracking
- [ ] **Filter/sort on admin page** -- filter by status, sort by date, search by submitter
- [ ] **Open report count badge** -- sidebar badge showing unresolved report count
- [ ] **Rich HTML email template** -- formatted email with report details and direct link to admin page

### Future Consideration (v6+)

Features to defer until bug reporting volume justifies the investment.

- [ ] **Reporter status visibility** -- let submitters see their own report statuses (new page + queries)
- [ ] **Admin reply to reporter via email** -- SES send to arbitrary addresses on status change
- [ ] **Report categories/tags** -- categorize by area (UI, data, performance, AI, etc.)
- [ ] **Bulk status operations** -- close/resolve multiple reports at once
- [ ] **Polling refresh on admin page** -- auto-refresh every 30s for new reports

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| BugReport Prisma model + migration | HIGH | LOW | P1 |
| Floating button + modal form | HIGH | LOW | P1 |
| createBugReport server action | HIGH | LOW | P1 |
| SES CDK infrastructure (identity + IAM) | HIGH | MEDIUM | P1 |
| SES email notification | HIGH | LOW | P1 |
| Admin bug reports page | HIGH | MEDIUM | P1 |
| Status workflow (update action + UI) | MEDIUM | LOW | P1 |
| Sidebar nav (admin-only) | MEDIUM | LOW | P1 |
| Success toast | MEDIUM | LOW | P1 |
| Browser metadata capture | MEDIUM | LOW | P2 |
| Admin notes on reports | MEDIUM | MEDIUM | P2 |
| Filter/sort on admin page | MEDIUM | LOW | P2 |
| Open report count badge | LOW | LOW | P2 |
| Rich HTML email template | LOW | LOW | P2 |
| Reporter status visibility | LOW | HIGH | P3 |
| Report categories/tags | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v5.0 launch (9 features)
- P2: Should have, add in v5.x when time allows (5 features)
- P3: Nice to have, defer to future milestones (2 features)

## Complexity Assessment

**Overall milestone complexity: LOW-MEDIUM.**

This is a straightforward CRUD feature with one integration point (AWS SES). The app already has all the UI components, auth patterns, admin gating, and database infrastructure needed. The main new work:

1. **One new Prisma model** -- ~10-15 lines of schema, standard migration
2. **Two server actions** -- createBugReport (validate + save + email) and updateBugReportStatus (status change)
3. **One client component** -- floating button + modal with form (uses existing dialog/textarea/button)
4. **One page route** -- admin bug reports list with table and status controls
5. **One AWS integration** -- SES email send via `@aws-sdk/client-ses` (SDK already available in the project)
6. **One CDK change** -- SES identity verification + IAM policy on ECS task role

No new architectural patterns. No new npm dependencies beyond `@aws-sdk/client-ses` (which may already be available via the existing Bedrock SDK). No complex state management. No WebSocket/polling additions. This is the lightest milestone the project has had.

**Estimated phase count: 3-4 phases** (schema + CDK infra, submission flow, admin dashboard, integration testing).

## Sources

- [In-App Bug Reporting: The Complete Guide -- Gleap](https://www.gleap.io/blog/in-app-bug-reporting-guide) -- UX patterns for in-app reporting
- [Bug Reporting Guide: Best Practices for QA and Testers 2025 -- MantraIdeas](https://mantraideas.com/bug-reporting-guide-qa-testing/) -- report field best practices
- [How to Send Transactional Email with AWS SES in Next.js -- SuprSend](https://www.suprsend.com/post/how-to-implement-email-sending-in-next-js-with-aws-ses) -- SES + Next.js integration pattern
- [Issue Tracker Dashboard Example -- Bold BI](https://www.boldbi.com/dashboard-examples/information-technology/issue-tracker-dashboard/) -- admin dashboard layout patterns
- [Sending Emails with NextJS and Amazon SES -- Medium](https://medium.com/nerd-for-tech/sending-emails-with-nextjs-and-amazon-simple-email-services-ses-8e4e10d1d397) -- SES SDK usage
- [AWS SES Documentation -- Sending Email](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/ses-examples-sending-email.html) -- official AWS reference
- Existing codebase: `lib/auth/authorization.ts` -- admin check pattern, `isAdmin()` function, `ADMIN_EMAIL` constant
- Existing codebase: `components/layout/app-shell.tsx` -- layout wrapper receiving `user` and `isAdmin` props
- Existing codebase: `components/layout/sidebar.tsx` -- nav items and admin-gated rendering pattern
- Existing codebase: `prisma/schema.prisma` -- current data model with User table from v4.0

---
*Feature research for: v5.0 Bug Reporting -- Requirements Foundry*
*Researched: 2026-03-26*
