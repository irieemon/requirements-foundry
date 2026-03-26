# Project Research Summary

**Project:** Requirements Foundry v5.0
**Domain:** In-app bug reporting with email notifications and admin dashboard
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

Requirements Foundry v5.0 adds a lightweight in-app bug reporting system to an existing Next.js 16 + AWS (ECS Fargate, RDS PostgreSQL, CDK) application. This is a well-understood CRUD feature with one meaningful integration point: AWS SES for email notifications. Every required UI component, auth pattern, admin gating mechanism, and database infrastructure already exists in the codebase. The only genuinely new work is one Prisma model, two server actions, a floating button with modal, an admin dashboard page, and wiring up SES. The only new npm dependency is `@aws-sdk/client-sesv2` — everything else is already installed. Estimated complexity is LOW-MEDIUM; this is the lightest milestone the project has seen.

The recommended approach follows the established codebase patterns throughout: server actions (not API routes) for mutations, fire-and-forget SES calls (not blocking), `isAdmin()` + notFound() for admin gating (not 403), string fields for status (not Prisma enums), and Radix UI primitives for the modal. Build order should proceed schema-first (BugReport model + migration), then user-facing submission flow, then admin dashboard, then polish and differentiators. The CDK infrastructure changes (SES identity + IAM policy) must deploy before the application code that sends email goes live.

The primary risks are infrastructure-related: SES sandbox mode silently blocking email delivery, missing IAM permissions on the ECS task role, and SES region mismatch during identity verification. All three are LOW recovery cost but will cause silent failures if not addressed before deployment. The secondary architectural risk is placing the email call in the critical path of the submission server action — if SES fails transient, bug report submissions will appear to fail from the user's perspective. The fire-and-forget pattern (`sendEmail().catch(log)`) is non-negotiable and must be the architecture from day one.

## Key Findings

### Recommended Stack

The stack research confirmed that one new package is all that's needed: `@aws-sdk/client-sesv2` (^3.1015.0), which shares the `@smithy/*` core already installed via `@aws-sdk/client-s3`. Everything else — dialog, textarea, form validation, table, status pill, toast, select, auth — is already in the codebase. CDK infrastructure changes use `aws-cdk-lib/aws-ses` (already bundled in the installed `aws-cdk-lib ^2.241.0`) to create an `ses.EmailIdentity` construct and add `ses:SendEmail` to the existing ECS task role. SES sandbox mode is acceptable for this POC since both sender and recipient (the admin) are the same known email address that can be verified once.

**Core technologies:**
- `@aws-sdk/client-sesv2` ^3.1015.0: send bug notification emails to admin — only new dependency; SES v2 is the current API (v1 is maintenance-mode)
- `aws-cdk-lib/aws-ses` (already installed): CDK construct to verify SES email identity and grant IAM permissions — keeps infrastructure as code consistent with the rest of the stack
- Prisma 7.2.0 (existing): BugReport model with string status field — follows the dominant codebase pattern of Run.status, Upload.extractionStatus as strings
- `@radix-ui/react-dialog` (existing): modal for bug report submission — already used for share management dialog in v4.0
- `react-hook-form` ^7.70.0 + `zod` ^4.3.5 (existing): form validation — same pattern as all other forms in the application
- `sonner` ^2.0.7 (existing): submission feedback toast — already installed and used throughout

### Expected Features

All research agrees this feature is well-scoped. The full feedback loop (user submits report → admin receives email → admin manages status) is achievable in 3-4 phases with no architectural surprises.

**Must have (table stakes — v5.0 launch):**
- Floating "Report Bug" button on all authenticated pages — users need a persistent, discoverable entry point or they revert to email/Slack and reports get lost
- Modal form with freeform description textarea — standard UX pattern, no page navigation, no context loss
- Automatic page URL and user identity capture — zero friction; the system knows who is logged in and where they are
- SES email notification to admin on submission — admin needs immediate notification, not to discover reports hours later by checking a dashboard
- Admin-only bug reports page at `/bug-reports` — dedicated place to see all reports with status, submitter, date, description preview
- Status workflow (open/in-progress/resolved/closed) with admin update capability — without status, the list becomes an undifferentiated pile
- Admin-only sidebar nav item gated by `isAdmin` prop — using lucide `Bug` icon, consistent with existing sidebar pattern
- Success toast on submission — users need confirmation their report was received or they will submit duplicates

**Should have (differentiators — v5.x after validation):**
- Browser/viewport metadata capture (userAgent, viewport size) — reduces follow-up questions needed for reproduction
- Admin notes on reports — internal paper trail without building a full ticketing system
- Filter/sort on admin dashboard — necessary once reports accumulate past ~20
- Open report count badge in sidebar — admin sees urgency without navigating to the page
- Rich HTML email template with direct admin dashboard link — admin can triage from inbox without opening the app

**Defer (v6+):**
- Reporter status visibility (users see their own report history) — creates a new user-facing page, SES sends to arbitrary addresses, and bidirectional communication expectations
- Screenshot/file attachment uploads — requires S3 upload flow, file type validation, preview rendering; page URL + description is sufficient for this internal tool
- Full ticketing features (assignment, due dates, labels, sprints) — JIRA/Linear already exist and do this infinitely better

### Architecture Approach

The architecture fits cleanly within the existing layer structure. Only four existing files need modification (all additive, all low-risk): `prisma/schema.prisma` (add BugReport model), `app/(authenticated)/layout.tsx` (add FAB), `components/layout/sidebar.tsx` (add admin nav item), and `infra/lib/requirements-foundry-stack.ts` (add SES IAM policy + env var). All new code is in new files that follow established directory conventions.

**Major components:**
1. `BugReportFAB` + `BugReportModal` (`components/bug-reports/`) — floating button visible on all authenticated pages; modal captures URL automatically on open; self-contained client component imported into the server layout; uses existing Radix Dialog, react-hook-form, sonner
2. `server/actions/bug-reports.ts` — three server actions: `submitBugReport` (validate + DB write + fire-and-forget SES), `getBugReports` (admin-gated Prisma query), `updateBugReportStatus` (admin-gated status update + revalidatePath)
3. `lib/email/ses.ts` — SES v2 client singleton; `sendBugReportNotification()` with HTML + plaintext body; decoupled from submission critical path via fire-and-forget
4. `app/(authenticated)/bug-reports/page.tsx` — admin-only server component; `isAdmin()` check with `notFound()` redirect; Prisma query ordered by createdAt desc; table rendered with existing `table.tsx` and `status-pill.tsx`
5. `BugReport` Prisma model — id, description (Text), pageUrl, submitterEmail, submitterName, status (string, default "open"), adminNotes (Text, nullable), createdAt, updatedAt; indexes on status, submitterEmail, createdAt

### Critical Pitfalls

1. **SES sandbox silently blocks email delivery** — verify BOTH sender AND admin recipient email identities in SES us-east-1 via CDK `ses.EmailIdentity` before deploying app code; bug reports save successfully but admin never receives notifications; add CloudWatch alarm for SES send failures to surface silent failures; sandbox mode is permanently acceptable since the admin email is a single known address

2. **Missing `ses:SendEmail` IAM permission on ECS task role** — add `ses:SendEmail` and `ses:SendRawEmail` to taskRole in CDK stack scoped to SES identity ARN; works locally (developer has personal AWS credentials) but fails on ECS with `AccessDeniedException`; deploy CDK changes before app code ships

3. **Email failure blocks bug report submission** — use fire-and-forget with `.catch()` logging; never `await` the SES call inside the response path or inside a Prisma transaction; the report is the primary artifact, email is notification convenience; return success based solely on DB write

4. **Admin server actions missing authorization** — check `isAdmin()` as the FIRST line of every admin server action (getBugReports, updateBugReportStatus); UI-only admin gating is insufficient since Next.js server actions are independently callable HTTP endpoints; follow the existing 404-not-403 convention

5. **SES region mismatch** — verify identity explicitly in us-east-1, not whatever region the AWS Console last showed; set `region: process.env.AWS_REGION || 'us-east-1'` in the SES client constructor; CDK `ses.EmailIdentity` automatically uses the stack's region which eliminates this risk if CDK is used

## Implications for Roadmap

Based on dependency analysis and pitfall mapping across all four research files, a 4-phase structure is recommended. ARCHITECTURE.md explicitly proposes this ordering; PITFALLS.md confirms the sequencing is mandatory.

### Phase 1: Schema and CDK Infrastructure

**Rationale:** The BugReport Prisma model is the data foundation that everything else depends on. The SES identity + IAM permissions must be deployed before application code that sends email ships — Pitfalls 1, 2, and 5 are all infrastructure-first failures. These two concerns (schema migration and CDK infra) can deploy together as a single CDK + Prisma migration step.
**Delivers:** BugReport model + migration applied to production DB; SES email identity verified in us-east-1; `ses:SendEmail` and `ses:SendRawEmail` on ECS task role; `BUG_REPORT_ADMIN_EMAIL` and `SES_SENDER_EMAIL` env vars on ECS task definition; CDK deployed and verified before app code ships
**Addresses:** Table stakes — BugReport Prisma model (P1), SES CDK infrastructure (P1)
**Avoids:** Pitfall 1 (sandbox blocking), Pitfall 2 (missing IAM), Pitfall 5 (region mismatch)

### Phase 2: Bug Report Submission Flow

**Rationale:** With schema + infra in place, the user-facing submission path can be built and fully tested end-to-end. This is the highest user-value surface: it enables every user to report bugs immediately. It touches only new files (low merge risk) plus one additive line in layout.tsx.
**Delivers:** Floating FAB visible on all authenticated pages; modal with description textarea, auto-captured URL, and submitter identity; `submitBugReport` server action (validate + DB write + fire-and-forget SES); `lib/email/ses.ts` SES client; success toast on submission; layout.tsx modification (add FAB)
**Uses:** `@aws-sdk/client-sesv2`, Radix Dialog, react-hook-form + Zod, sonner toast
**Implements:** BugReportFAB, BugReportModal, `lib/email/ses.ts`, submit server action
**Avoids:** Pitfall 3 (email blocking submission), double-submit (loading state + disabled button), wrong URL capture (capture on FAB click, not modal render)

### Phase 3: Admin Dashboard

**Rationale:** Admin management can be built in parallel with Phase 2 (both depend only on the schema) but is slightly lower user priority than the submission flow. The admin page is DB-only reads — no SES dependency. It requires careful attention to authorization since it introduces admin-only server actions.
**Delivers:** `/bug-reports` admin page with table view (status, submitter, date, description preview, pageUrl); status dropdown with `updateBugReportStatus` server action; admin-only sidebar nav item with Bug icon; `getBugReports` server action; sidebar.tsx modification (add conditional nav item)
**Implements:** BugReportTable, StatusUpdate components, `app/(authenticated)/bug-reports/page.tsx`
**Avoids:** Pitfall 4 (admin auth bypass — `isAdmin()` as first line of every admin server action, 404-not-403)

### Phase 4: Polish and Differentiators

**Rationale:** Once the core feedback loop (submit → email → admin dashboard → status update) is working and getting real usage, the P2 features that make the experience notably better can be added. These are all LOW complexity. Usage data from Phase 1-3 should inform which P2 features to prioritize first.
**Delivers:** Browser/viewport metadata capture (userAgent, viewport size stored as JSON); filter/sort on admin dashboard (query params for status filter, sort by date); open report count badge in sidebar (count query on layout render); rich HTML email template with admin dashboard link; admin notes on reports; rate limiting on submission (max 5/hour per user via DB count check); character counter on description textarea (2000 char max); mobile layout check for FAB position
**Addresses:** All P2 features from FEATURES.md; UX pitfalls (loading state, double-submit prevention, mobile layout)

### Phase Ordering Rationale

- Phase 1 is strictly prerequisite: the BugReport model is needed by every other phase, and SES infra must be deployed before the email call in Phase 2 can succeed
- Phase 2 before Phase 3 because the submission flow has higher user value and is fully testable end-to-end once infra is ready; both phases only depend on Phase 1
- Phase 3 as its own phase because admin server action authorization requires dedicated attention — Pitfall 4 is the easiest pitfall to miss and needs to be explicitly verified
- Phase 4 last because P2 features are additive enhancements that benefit from real usage data; rate limiting in particular is best calibrated after seeing actual submission patterns

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1:** CDK `ses.EmailIdentity` construct and Prisma migration are well-documented patterns; exact CDK changes are specified in STACK.md and ARCHITECTURE.md
- **Phase 2:** All UI components exist; server action pattern is established across 12 existing action files; fire-and-forget SES pattern is specified in ARCHITECTURE.md with code samples
- **Phase 3:** Admin page follows identical pattern to existing admin views; `isAdmin()` + notFound() is the established convention
- **Phase 4:** All individual P2 features are documented patterns (metadata capture, query params for filtering, badge count query, rate limiting via DB count)

No phases require a `/gsd:research-phase` call. All necessary implementation detail is in the four research files and the existing codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new package identified with version; all other components verified in existing `package.json` and codebase; AWS SDK v3 version compatibility confirmed via shared `@smithy/*` core |
| Features | HIGH | Features cross-validated against codebase capabilities, UX best practices for in-app reporting, and internal tool constraints; anti-features clearly reasoned with specific "why not" rationale |
| Architecture | HIGH | Based on direct codebase analysis of existing server action patterns, admin gating, Prisma schema, CDK stack, and layout structure; component boundaries match established conventions with code samples provided |
| Pitfalls | HIGH | Six critical pitfalls with direct codebase evidence (e.g., ECS task role confirmed to have NO SES permissions via reading `requirements-foundry-stack.ts`); all recovery paths rated LOW cost |

**Overall confidence:** HIGH

### Gaps to Address

- **`notifiedAt` column:** PITFALLS.md recommends adding a nullable `notifiedAt` DateTime to the BugReport model to track email delivery status and enable future retry visibility. STACK.md's schema does not include it. Recommend adding it in Phase 1 schema design — one nullable DateTime column with near-zero cost that makes the admin dashboard more informative and enables future retry logic.

- **SES sandbox verification step:** Sandbox mode is confirmed acceptable for this POC, but the admin email must be manually verified in SES us-east-1 (either via CDK `ses.EmailIdentity` or the AWS Console). This is a human action that cannot be automated. Flag in Phase 1: verify before running CDK deploy, or deploy CDK EmailIdentity construct which sends the verification email automatically.

- **Rate limiting approach:** Research flags the need for rate limiting (max 5 reports/user/hour) but does not specify implementation details. For this internal tool a simple DB-based check (`count WHERE userId = X AND createdAt > now()-1hr`) is sufficient — no Redis or external service needed. Confirm this approach during Phase 2 planning rather than adding infrastructure overhead.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `package.json`, `prisma/schema.prisma`, `infra/lib/requirements-foundry-stack.ts`, `lib/auth/authorization.ts`, `components/layout/app-shell.tsx`, `components/layout/sidebar.tsx`, `server/actions/` — direct analysis confirming existing patterns, gaps, and exact file modification points
- [AWS SES v2 JavaScript SDK docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/sesv2/) — SendEmailCommand API reference, verified 2026-03-26
- [CDK EmailIdentity construct docs](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ses.EmailIdentity.html) — CDK v2 SES identity creation, stable since CDK v2.0
- [AWS SES sandbox docs](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) — sandbox limitations and production access process
- [AWS SES IAM access control](https://docs.aws.amazon.com/ses/latest/dg/control-user-access.html) — task role permission scoping

### Secondary (MEDIUM confidence)
- [How to Send Transactional Email with AWS SES in Next.js — SuprSend](https://www.suprsend.com/post/how-to-implement-email-sending-in-next-js-with-aws-ses) — SES + Next.js integration pattern
- [Sending emails from ECS Fargate in isolated subnet — devgem.io](https://www.devgem.io/posts/how-to-send-emails-from-an-aws-ecs-fargate-task-in-an-isolated-subnet) — confirms NAT Gateway approach for private subnets with egress
- [Next.js Server Action security — Arcjet](https://blog.arcjet.com/next-js-server-action-security/) — admin server action authorization patterns
- [In-App Bug Reporting: The Complete Guide — Gleap](https://www.gleap.io/blog/in-app-bug-reporting-guide) — UX patterns for in-app reporting

### Tertiary (LOW confidence — context only)
- [Issue Tracker Dashboard Example — Bold BI](https://www.boldbi.com/dashboard-examples/information-technology/issue-tracker-dashboard/) — admin dashboard layout inspiration; not used for implementation guidance given existing `table.tsx` component covers all requirements

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
