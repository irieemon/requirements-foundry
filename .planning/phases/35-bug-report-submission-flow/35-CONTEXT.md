# Phase 35: Bug Report Submission Flow - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Any authenticated user can report a bug from any page without losing context. A floating button opens a minimal modal, the report is saved to the database, and the admin receives a rich HTML email notification. This phase delivers the button, modal, server action, SES email sending, and success toast — not the admin dashboard (Phase 36).

</domain>

<decisions>
## Implementation Decisions

### Bug Button Placement & Style
- **D-01:** Floating action button (FAB) fixed to the bottom-right corner of every authenticated page. Rendered inside AppShell so it's always visible regardless of sidebar state.
- **D-02:** Icon-only circular button using lucide `Bug` icon. Tooltip on hover shows "Report Bug". No text label.

### Modal Form Design
- **D-03:** Single field only — a textarea labeled "What went wrong?". No severity, no category. Minimal friction maximizes report volume.
- **D-04:** Page URL displayed as a read-only muted hint below the textarea (e.g., "📍 Page: /projects/abc123"). Builds user trust that correct context is captured.
- **D-05:** Auto-captured fields (hidden from user): pageUrl (window.location.pathname), submitterEmail, submitterName (from session), browserMetadata (userAgent + viewport as JSON string).
- **D-06:** Modal uses existing shadcn Dialog component, consistent with share-dialog.tsx pattern.

### Email Notification
- **D-07:** Rich HTML email with styled card layout, colored status badge, and a "View in Dashboard" button. Matches EMAIL-02 requirement for rich HTML with report details.
- **D-08:** Email links to /bug-reports dashboard page (not to a specific report ID). Avoids coupling to Phase 36's URL structure.
- **D-09:** Email includes: submitter name/email, page URL, description, browser metadata summary, and submission timestamp.

### Error Handling & Edge Cases
- **D-10:** SES failure is fire-and-forget — bug report is always saved to DB first, email sending is attempted after. If SES fails, error is logged server-side but user sees normal success toast. Matches roadmap success criteria #5.
- **D-11:** Simple client-side cooldown — submit button disabled for 30 seconds after successful submission. Prevents accidental double-submits. No server-side rate limiting (internal corporate tool with SSO).
- **D-12:** Description field required, minimum length validation (e.g., 10 chars). Empty submissions blocked client-side.

### Claude's Discretion
- Email HTML template design details (colors, spacing, responsive layout)
- Server action implementation pattern (matches existing server/actions/*.ts style)
- Toast message wording and duration
- Textarea placeholder text and character limit
- browserMetadata JSON structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Components
- `components/ui/dialog.tsx` — Dialog component used for modals (shadcn pattern)
- `components/projects/share-dialog.tsx` — Reference implementation for dialog + server action + toast pattern
- `components/layout/app-shell.tsx` — Where the FAB will be rendered (wraps all authenticated pages)
- `components/layout/sidebar.tsx` — Sidebar nav for understanding layout context

### Server Actions
- `server/actions/shares.ts` — Reference for server action pattern with Prisma operations
- `lib/toast-patterns.ts` — Existing toast utility using sonner

### Data & Infrastructure
- `prisma/schema.prisma` — BugReport model (added in Phase 34)
- `infra/lib/requirements-foundry-stack.ts` — SES email identity and env vars (BUG_REPORT_ADMIN_EMAIL, SES_SENDER_EMAIL)

### Requirements
- `.planning/REQUIREMENTS.md` — SUB-01 through SUB-04 (submission), EMAIL-01 and EMAIL-02 (notification)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Dialog component**: shadcn Dialog already used in share-dialog.tsx — proven pattern for modal forms
- **toast from sonner**: Already integrated via lib/toast-patterns.ts — use toast.success() for submission confirmation
- **Server actions pattern**: All server actions use "use server" directive with Prisma client — follow shares.ts pattern
- **lucide-react icons**: Bug icon available from lucide-react (already a project dependency)
- **AppShell component**: Wraps all authenticated pages, receives `user` and `isAdmin` props — user info available for auto-capture

### Established Patterns
- **Form submission**: Dialog components handle their own open/close state, call server actions directly, show toast on success
- **Error handling**: Server actions return typed results, client components show toast on error
- **Styling**: Tailwind CSS with shadcn component library, consistent spacing and color tokens

### Integration Points
- **AppShell**: FAB renders as a sibling to the main content area inside AppShell
- **Session/auth**: User info (email, name) available from AppShell's `user` prop for auto-capture
- **Prisma client**: BugReport.create() for database insertion
- **AWS SES**: ses.SendEmail via AWS SDK using BUG_REPORT_ADMIN_EMAIL and SES_SENDER_EMAIL env vars

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 35-bug-report-submission-flow*
*Context gathered: 2026-03-26*
