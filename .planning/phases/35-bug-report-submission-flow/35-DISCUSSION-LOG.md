# Phase 35: Bug Report Submission Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 35-bug-report-submission-flow
**Areas discussed:** Bug button placement & style, Modal form design, Email notification content, Error & edge cases

---

## Bug Button Placement & Style

| Option | Description | Selected |
|--------|-------------|----------|
| Floating action button | Fixed bottom-right corner FAB on every authenticated page. Always visible, doesn't depend on sidebar state. Added inside AppShell. | ✓ |
| Sidebar menu item | Permanent item at bottom of sidebar nav. Consistent with existing nav pattern but invisible when sidebar is collapsed on mobile. | |
| Header icon button | Small icon in the top header bar next to user menu. Subtle, always visible, but easy to miss. | |

**User's choice:** Floating action button
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Icon only | Small circular button with bug icon (lucide Bug). Clean, unobtrusive. Tooltip on hover shows 'Report Bug'. | ✓ |
| Icon + label | Pill-shaped button with bug icon and 'Report Bug' text. More discoverable but takes more space. | |
| You decide | Claude picks the best approach based on existing UI patterns | |

**User's choice:** Icon only
**Notes:** None

---

## Modal Form Design

| Option | Description | Selected |
|--------|-------------|----------|
| Description only | Single textarea for 'What went wrong?'. Page URL, user email/name, and browser metadata captured automatically and hidden. Minimal friction. | ✓ |
| Description + severity | Textarea plus severity dropdown (low/medium/high/critical). Gives admin triage info but adds friction. | |
| Description + category | Textarea plus category select (UI bug, data issue, performance, other). Helps admin route but more friction. | |

**User's choice:** Description only
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Visible as read-only hint | Show current page URL as small muted line below textarea. Builds trust that right context is captured. | ✓ |
| Completely hidden | User sees only textarea and buttons. Cleaner but user can't verify what context is sent. | |
| You decide | Claude picks based on existing modal patterns | |

**User's choice:** Visible as read-only hint
**Notes:** None

---

## Email Notification Content

| Option | Description | Selected |
|--------|-------------|----------|
| Rich HTML | Styled HTML email with card layout, colored status badge, and 'View in Dashboard' button. Professional look, matches EMAIL-02. | ✓ |
| Simple HTML | Basic HTML with headings and paragraphs, no fancy styling. Lower maintenance. | |
| Plain text | No HTML. Maximum compatibility but no visual structure. | |

**User's choice:** Rich HTML
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Link to dashboard | Link goes to /bug-reports. Since Phase 36 isn't built yet, avoids coordinating URL patterns. | ✓ |
| Link to specific report | Link includes report ID. More convenient but requires knowing Phase 36's URL structure. | |
| You decide | Claude picks the pragmatic approach | |

**User's choice:** Link to dashboard
**Notes:** None

---

## Error & Edge Cases

| Option | Description | Selected |
|--------|-------------|----------|
| Save report, silent fail | Bug report saved to DB regardless. Email failure logged server-side, user sees success toast. Fire-and-forget per roadmap. | ✓ |
| Save report, warn user | Bug report saved, toast says 'Report saved, email notification failed'. Transparent but potentially confusing. | |
| You decide | Claude picks based on roadmap success criteria | |

**User's choice:** Save report, silent fail
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Simple client-side cooldown | Disable submit for 30 seconds after success. Prevents double-submits. No server-side rate limiting for corporate tool. | ✓ |
| No rate limiting | Users submit freely. Trust corporate SSO users. | |
| You decide | Claude picks appropriate level | |

**User's choice:** Simple client-side cooldown
**Notes:** None

---

## Claude's Discretion

- Email HTML template design details
- Server action implementation pattern
- Toast message wording and duration
- Textarea placeholder text and character limit
- browserMetadata JSON structure

## Deferred Ideas

None — discussion stayed within phase scope.
