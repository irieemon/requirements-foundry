# Pitfalls Research: Adding Bug Reporting with Email Notifications

**Domain:** Bug reporting with email notifications and admin dashboard added to existing Next.js 16 + AWS (ECS Fargate, RDS PostgreSQL, Cognito, CDK) application
**Researched:** 2026-03-26
**Confidence:** HIGH (direct codebase analysis of infrastructure stack, auth layer, Prisma schema + AWS SES documentation + community patterns)

---

## Critical Pitfalls

### Pitfall 1: AWS SES Sandbox Silently Blocks Email Delivery

**What goes wrong:**
Every new SES account starts in sandbox mode. In sandbox, you can only send email to verified email addresses (both sender AND recipient must be verified). The bug report feature deploys, reports save to the database successfully, but the admin never receives notification emails. No user-visible error occurs because the server action catches the SES error and continues. The feature appears to work but notifications are silently lost.

**Why it happens:**
Developers verify the sender email, test by sending to their own (also verified) email, and everything works. They forget that sandbox restricts recipients too. On production, if the admin email is not verified as a recipient, SES throws `MessageRejected: Email address is not verified`. Since the app correctly decouples DB save from email (or should -- see Pitfall 3), the report saves but the email fails silently.

**How to avoid:**
1. For this POC with a single admin recipient (hardcoded `sean.mcinerney@merkle.com`), sandbox mode is actually sufficient. Verify BOTH the sender identity AND the admin email as a verified identity in SES us-east-1.
2. Verify identities via CDK (`ses.EmailIdentity`) or manually in the AWS Console before deploying application code.
3. Add a CloudWatch metric/alarm for SES send failures so silent failures become visible.
4. Document the sandbox limitation: if admin email changes, the new email must be verified in SES.
5. Only request production access if email needs to reach non-verified recipients in the future.

**Warning signs:**
- Bug reports save to DB but no emails arrive
- CloudWatch logs show `MessageRejected` errors from SES
- SES console in us-east-1 shows "Sandbox" status in sending statistics
- SES dashboard shows 0 successful sends

**Phase to address:**
Infrastructure phase (SES identity verification + CDK) -- must be complete and verified before application code that sends email is deployed.

---

### Pitfall 2: Missing SES IAM Permissions on ECS Task Role

**What goes wrong:**
The existing ECS Fargate task role (`requirements-foundry-prod-task`) has permissions for S3 (`grantReadWrite`), Bedrock (`InvokeModel`), CloudWatch Logs, and SSM. It has zero SES permissions. The application code calls `ses.sendEmail()` and gets `AccessDeniedException: User: arn:aws:sts::...:assumed-role/requirements-foundry-prod-task/... is not authorized to perform ses:SendEmail`.

**Why it happens:**
The CDK stack was built incrementally for document processing. SES is the first new AWS service integration since v2.0. Developers write and test email-sending code locally using their personal AWS credentials (which typically have broader permissions), it works perfectly, then fails on ECS where the task role is properly locked down.

**How to avoid:**
Add `ses:SendEmail` and `ses:SendRawEmail` to the task role in the CDK stack, scoped to the verified SES identity ARN. Do NOT use `Resource: '*'`.

```typescript
// In requirements-foundry-stack.ts, after existing taskRole policies:
taskRole.addToPolicy(new iam.PolicyStatement({
  actions: ['ses:SendEmail', 'ses:SendRawEmail'],
  resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
}));
```

Deploy the CDK stack BEFORE deploying application code that uses SES. Run `cdk diff` to verify the policy appears.

**Warning signs:**
- Works locally but fails on AWS
- CloudWatch logs show `AccessDeniedException` for `ses:SendEmail`
- `cdk diff` output shows no SES-related IAM changes
- ECS task crashes or logs errors on first bug report submission

**Phase to address:**
Infrastructure phase -- SES identity + IAM policy must be in the same CDK deployment, before application code ships.

---

### Pitfall 3: Email Failure Blocks or Breaks Bug Report Submission

**What goes wrong:**
The server action saves the bug report to the database AND sends an email notification in sequence within the same try/catch. If SES throws (rate limit, invalid config, temporary outage, IAM misconfiguration), the error propagates to the user. Either: (a) the bug report is not saved at all because the error aborts the function, or (b) the report saves but the server action returns an error response, confusing the user into thinking submission failed.

**Why it happens:**
Developers treat email as part of the critical path. They write `await db.bugReport.create(...)` then `await ses.sendEmail(...)` in sequence, or worse, inside a Prisma `$transaction`. When the email call fails, the whole operation fails.

**How to avoid:**
1. Save the bug report to the database FIRST as the primary operation.
2. Attempt email notification as a fire-and-forget side effect with its own error handling.
3. Return success to the user based solely on DB save, never on email delivery.
4. Add a `notifiedAt` timestamp column on the BugReport model (nullable). Set it after successful email send. This enables future retry logic and makes email status visible in the admin dashboard.

```typescript
// Correct pattern:
const report = await db.bugReport.create({ data: { ... } });
// Fire-and-forget with error logging
sendAdminNotification(report).catch(err => {
  console.error('[BugReport] Email notification failed:', err.message);
});
return { success: true, id: report.id };
```

**Warning signs:**
- Bug reports intermittently fail to save (the actual problem is email, not DB)
- Users see "Error submitting bug report" but SES was the failure, not Prisma
- No separate error handling for the email call
- No `notifiedAt` or email delivery status on the BugReport model

**Phase to address:**
Application logic phase (server action design) -- the decoupled pattern must be the architecture from day one, not retrofitted after email failures are discovered.

---

### Pitfall 4: Admin Dashboard Missing Server-Side Authorization

**What goes wrong:**
The admin-only bug reports page is created at a route like `/bug-reports` or nested under `/admin`. The page component checks `isAdmin()` and renders content only for admins. But the underlying server actions that fetch bug report data and update statuses do NOT check `isAdmin()`. A non-admin user who knows the server action name (visible in browser network tab) can call it directly and access all bug reports or change their status.

**Why it happens:**
The existing admin pattern in this codebase is straightforward: the projects page checks `isAdmin()` to show the "All Projects" toggle. Developers replicate this UI-only check pattern. They protect the page render but forget that Next.js Server Actions are independently callable HTTP endpoints that need their own authorization.

**How to avoid:**
1. Every server action for bug report management (list all reports, update status, etc.) must call `isAdmin()` as its first operation, using the existing pattern from `lib/auth/authorization.ts`.
2. Follow the project's 404-not-403 convention: return `notFound()` for non-admins rather than a 403 error.
3. The bug SUBMISSION endpoint must be open to all authenticated users. Only MANAGEMENT endpoints are admin-only. Keep these clearly separated in the code (e.g., `submitBugReport()` vs `adminGetBugReports()`, `adminUpdateBugReportStatus()`).
4. Test: log in as a non-admin user and manually invoke the admin server actions via browser dev tools.

**Warning signs:**
- Admin page component checks `isAdmin()` but server actions don't
- Non-admin user sees 403 instead of 404 (leaks the route's existence)
- Status update server action accepts any authenticated caller
- No test covers non-admin access to admin server actions

**Phase to address:**
Admin dashboard phase -- authorization checks must be the FIRST line of code in every admin server action, before any DB query.

---

### Pitfall 5: SES Region Mismatch Causes Identity-Not-Verified Errors

**What goes wrong:**
SES identity verification is per-region. The developer verifies the sender email identity in the AWS Console, but the Console is set to a different region (e.g., us-west-2) than the application (us-east-1). The application sends email via SES in us-east-1 and gets `MessageRejected: Email address is not verified` even though the identity clearly shows as verified in the Console.

**Why it happens:**
The AWS Console defaults to the last-used region, which may not be us-east-1. SES has no cross-region identity sharing. This is especially confusing because other AWS services (like IAM) are global, so developers assume SES verification is too.

**How to avoid:**
1. Explicitly verify the SES identity in us-east-1 (the application's region, confirmed in PROJECT.md).
2. In the SES SDK client, explicitly set the region: `new SESClient({ region: process.env.AWS_REGION || 'us-east-1' })`.
3. Use the `AWS_REGION` environment variable that is already set on the ECS task definition.
4. If using CDK to create the SES identity (`ses.EmailIdentity`), it automatically uses the stack's region (us-east-1).

**Warning signs:**
- "Email address is not verified" errors despite identity showing verified in Console
- Check the region dropdown in the AWS Console -- it may say a different region
- SES dashboard in us-east-1 shows no verified identities

**Phase to address:**
Infrastructure phase -- verify SES identity in us-east-1 explicitly, either via CDK or Console with region confirmed.

---

### Pitfall 6: Bug Report Modal Z-Index Conflicts with Existing Modals

**What goes wrong:**
The floating "Report Bug" button sits in the lower-left corner with a high z-index so it appears above page content. When the user opens the bug report modal, it conflicts with existing modals/dialogs in the application (share management dialog, export wizard, confirmation dialogs). Either the bug report modal appears behind another modal, or clicking the floating button while a dialog is open creates a confusing layered state.

**Why it happens:**
The application already has modal/dialog patterns (the share dialog from v4.0, the export wizard, confirmation dialogs). Each uses its own z-index layer. Adding a floating button + modal introduces a new z-index layer that wasn't part of the original design. Without a z-index management strategy, layers conflict.

**How to avoid:**
1. Use the existing UI component library's dialog/modal component (likely Radix Dialog or similar, based on the `components/ui` directory) which handles z-index and backdrop layering correctly.
2. The floating button should have a z-index below the modal backdrop layer (typically z-40 or z-50 in Tailwind).
3. When the bug report modal is open, it should use the same portal and backdrop pattern as other dialogs.
4. Hide or disable the floating button when another modal is already open (detect via a global modal state or simply rely on the backdrop blocking clicks).
5. Test the specific scenario: open the share dialog, then try to click the bug report button.

**Warning signs:**
- Bug report button visible on top of other modals
- Bug report modal appears behind the share dialog
- Multiple backdrops stack, darkening the page excessively
- Clicking outside the bug report modal closes a different modal underneath

**Phase to address:**
UI phase (floating button + modal) -- test z-index interactions with all existing modal patterns in the app.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode admin email for notification recipient | Matches existing pattern in `authorization.ts`, no config needed | Adding notification recipients requires code change + deploy | POC -- acceptable since admin email is already hardcoded; revisit when Okta group-based admin detection is implemented |
| Plain text descriptions only (no rich text/screenshots) | Simpler schema, no file upload handling, no sanitization | Users can't show what they see; harder to reproduce bugs | MVP -- users can describe the bug. Add screenshot upload in a future milestone if needed |
| No email delivery tracking (`notifiedAt` column) | Simpler schema | Cannot detect failed notifications, no retry capability, admin doesn't know if they were notified | Never -- add `notifiedAt` from the start. It's one nullable DateTime column with near-zero cost |
| Synchronous SES call in server action (fire-and-forget) | No queue infrastructure needed | Slower response for user (SES round-trip ~100-500ms), no retry on failure | Acceptable for this low-volume internal tool. A queue (SQS) would be over-engineered |
| No bug report categories or priority levels | Simpler form, faster submission, fewer decisions | Harder to triage and filter as volume grows | MVP -- add categories later when there's data on what types of bugs are reported |
| String enum for status instead of Prisma enum | No separate enum migration, more flexible | Typos possible (e.g., "opne" instead of "open"), no DB-level validation | Acceptable given the project uses string enums for Run.status and Run.type already. Consistency matters more than purity |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| AWS SES SDK | Using `@aws-sdk/client-ses` v2 API style with callbacks | Use `@aws-sdk/client-ses` v3 with `SendEmailCommand` -- the project already uses v3 SDK patterns for S3 (`@aws-sdk/client-s3`) and Bedrock |
| AWS SES SDK | Creating a new SES client on every request | Create a singleton client in a shared module (e.g., `lib/ses.ts`) like the existing `lib/s3.ts` pattern |
| AWS SES | Sending from `no-reply@amazonaws.com` default | Verify a custom sender identity. For corporate email (merkle.com), using the admin's email as sender requires that email to be verified. Alternatively, verify the entire domain -- but this requires DNS changes (SPF/DKIM/DMARC records) which needs IT team involvement |
| AWS SES | Not configuring bounce/complaint handling | For sandbox + low volume POC, this is not blocking. But for production access request, AWS requires SNS topics for bounces and complaints. Wire these up in CDK when/if production access is needed |
| CDK | Deploying SES identity + application code in a single deployment | Deploy infrastructure first (SES identity verification, IAM policy), verify it works, THEN deploy application code. SES email verification requires clicking a confirmation link sent to the email address -- this is an async human step |
| Prisma | Running `prisma migrate deploy` without reviewing generated SQL | Always run `prisma migrate dev --create-only` locally, inspect the generated migration SQL, then deploy. The BugReport model is a new table so risk is low, but habit matters |
| Prisma | Adding a foreign key to User table without considering existing data | `User` records exist for all users who logged in since v4.0 (User upsert on login). A FK from `BugReport.submittedByUserId` to `User.id` is safe because the submitter must be logged in (and thus has a User record). But prefer storing `submitterEmail` as a String (matching `Project.userId` pattern) for consistency |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all bug reports without pagination on admin page | Page load slows, browser memory increases | Add limit/offset or cursor-based pagination from the start (20-50 per page) | 100+ bug reports (likely after a few months of use) |
| Sending SES email synchronously in request path | Bug report submission takes 500ms+ instead of <100ms | Fire-and-forget pattern: `sendEmail().catch(log)` without awaiting in the response path | When SES has latency spikes or throttling occurs |
| Querying all bug reports with includes on every admin page load | Slow page loads if reports reference many relations | Keep the BugReport model lean. Only include related data (submitter info) when needed | Not likely at this scale, but avoid eager loading patterns |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin authorization only on page component, not server actions | Non-admin users can call admin server actions directly via HTTP | Check `isAdmin()` in EVERY server action that reads or mutates bug report management data |
| Storing full email body in CloudWatch logs | Sensitive user-reported information visible in logs | Log only report ID, submitter email, and success/failure. Never log the bug description |
| No rate limiting on bug report submission | A user (or bot) submits thousands of reports, overwhelming the admin and potentially hitting SES rate limits | Add rate limiting: max 5 reports per user per hour. Use an in-memory counter or DB-based check since the user is authenticated |
| Rendering bug descriptions with `dangerouslySetInnerHTML` | Stored XSS: malicious user submits a report with script tags, admin views it and script executes | Use plain text rendering (React auto-escapes by default). Never use `dangerouslySetInnerHTML` for user-submitted content |
| Bug report form accessible to unauthenticated users | Spam reports from bots or anonymous users | Wrap the bug report server action with `getCurrentUser()` authentication check. The floating button should only render for authenticated users |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No submission confirmation feedback | User unsure if report was received; may submit again | Show a toast/success message immediately: "Bug report submitted. Thank you!" Close the modal on success |
| Modal closes on backdrop click while user is typing | User loses their entire description mid-write | Prevent backdrop-dismiss while the description field has content. Or auto-save to localStorage as a draft |
| No character limit or visible counter on description | User writes excessively long report or is unsure how much detail to provide | Add a max length (2000 chars) with a visible character counter. Textarea should indicate remaining characters |
| Floating button overlaps content on small screens | Button covers the last item in a list or an important action button | On mobile viewports, use a smaller button or move to a nav menu item. Test on the actual project pages where content extends to the lower-left |
| No loading state during submission | User clicks submit multiple times, creating duplicate reports | Disable submit button + show spinner during the server action. Re-enable only on error |
| Status changes on admin dashboard have no feedback | Admin clicks "Mark as Resolved" but can't tell if it worked until page refresh | Show optimistic UI update or toast: "Report #12 marked as resolved" |
| Bug report captures wrong page URL | The URL captured is the modal's URL, not the page the user was on when they clicked "Report Bug" | Capture `window.location.href` BEFORE opening the modal, and store it in the form state |

## "Looks Done But Isn't" Checklist

- [ ] **SES Identity Verified:** Check SES console in us-east-1 (not another region) -- both sender and admin recipient emails show "Verified" status
- [ ] **IAM Policy Deployed:** Run `cdk diff` and confirm `ses:SendEmail` appears in the task role policy. Or check IAM console for the `requirements-foundry-prod-task` role
- [ ] **Email Actually Arrives:** Submit a test bug report on AWS (not localhost) and confirm the email arrives in the admin inbox. Check spam folder
- [ ] **Error Resilience:** Temporarily remove SES IAM permissions, submit a bug report, confirm it saves to DB and user sees success (email fails silently)
- [ ] **Admin Auth on Actions:** Log in as a non-admin user, use browser DevTools to invoke the admin bug report listing server action -- should get 404
- [ ] **Admin Auth on Status Update:** As a non-admin, invoke the status update server action -- should get 404
- [ ] **Migration on Existing Data:** Run the migration against a copy of the production database (which has existing Projects, Users, etc.) -- should succeed without errors
- [ ] **Floating Button Z-Index:** Open the share management dialog, confirm the bug report button is NOT visible on top of it
- [ ] **Page URL Captured Correctly:** Submit a bug report from `/projects/abc123/stories` and confirm the stored URL is that page, not the modal URL
- [ ] **Mobile Layout:** View the app on a 375px viewport and confirm the floating button doesn't overlap critical content
- [ ] **Rate Limiting:** Submit 6 bug reports rapidly as the same user -- the 6th should be rejected with a friendly message
- [ ] **Double Submit Prevention:** Click submit twice rapidly -- only one report should be created

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SES sandbox blocking emails | LOW | Verify the recipient email in SES Console (us-east-1). Takes 2 minutes. For permanent fix, request production access (1-3 business days) |
| Missing IAM permissions | LOW | Add policy statement to CDK stack, deploy. Takes one `cdk deploy`. No data loss, no downtime |
| Email failure blocking report save | LOW | Refactor server action to decouple DB save from email send. No schema change needed. Reports already saved are unaffected |
| Admin page accessible to non-admins | LOW | Add `isAdmin()` check to server actions. No data exposure risk since bug reports contain user-submitted descriptions, not system secrets |
| SES region mismatch | LOW | Re-verify identity in us-east-1 or fix SES client region config. Takes minutes |
| Z-index conflicts | LOW | Adjust CSS z-index values on the floating button. No backend changes needed |
| Migration failure on production | MEDIUM | If migration partially applied, may need manual SQL cleanup. Prevention: always use `--create-only`, review SQL, test on DB copy first |
| Stored XSS via bug description | LOW | React JSX auto-escapes by default, so actual risk is very low. Only dangerous if `dangerouslySetInnerHTML` is used. Fix: remove dangerouslySetInnerHTML if present |
| Missing rate limiting | LOW | Add rate check to server action. Existing reports are valid (just possibly excessive). No data integrity issue |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SES sandbox / identity verification | Infrastructure (CDK + SES setup) | Send test email from AWS Console in us-east-1 before deploying app code |
| Missing IAM permissions on task role | Infrastructure (CDK + SES setup) | `cdk diff` shows `ses:SendEmail` and `ses:SendRawEmail` on task role |
| Email failure breaks submission | Application logic (server action) | Test: mock SES client to throw, verify bug report still saves to DB and user sees success |
| Admin auth bypass on server actions | Admin dashboard (page + server actions) | Manual test: call admin server actions as non-admin via DevTools, expect 404 |
| SES region mismatch | Infrastructure (CDK + SES setup) | Verify SES identity in us-east-1 Console; check SES client uses `AWS_REGION` env var |
| Z-index modal conflicts | UI (floating button + modal) | Open existing dialogs (share, export) and confirm bug button/modal layers correctly |
| Prisma migration issues | Schema design (BugReport model) | Review generated SQL with `--create-only`; test migration against production DB copy |
| No rate limiting on submissions | Application logic (server action) | Automated test: submit N+1 reports in quick succession, verify last is rejected |
| Double submission / no loading state | UI (modal + form) | Click submit rapidly, verify only one report created in DB |
| Page URL capture | UI (floating button click handler) | Submit from a deep page URL, verify stored `pageUrl` matches the originating page |

## Sources

- AWS SES sandbox documentation: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- AWS SES CDK module: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ses-readme.html
- AWS SES IAM access control: https://docs.aws.amazon.com/ses/latest/dg/control-user-access.html
- AWS SES DMARC/SPF/DKIM: https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html
- ECS task IAM roles: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
- SES CDK setup guide: https://bobbyhadz.com/blog/aws-ses-send-emails
- Prisma Migrate workflows: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
- Prisma migration limitations: https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues
- Next.js Server Action rate limiting: https://nextjsweekly.com/blog/rate-limiting-server-actions
- Next.js Server Action security: https://blog.arcjet.com/next-js-server-action-security/
- Codebase: `infra/lib/requirements-foundry-stack.ts` -- current task role has S3, Bedrock, CloudWatch, SSM permissions; NO SES
- Codebase: `lib/auth/authorization.ts` -- hardcoded admin email (`sean.mcinerney@merkle.com`), `isAdmin()` function, 404-not-403 pattern
- Codebase: `prisma/schema.prisma` -- User model exists (added in v4.0), `Project.userId` stores email string, existing string-based enums for Run status/type

---
*Pitfalls research for: Bug reporting with email notifications (v5.0) on Requirements Foundry*
*Researched: 2026-03-26*
