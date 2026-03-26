---
phase: 35-bug-report-submission-flow
plan: 01
subsystem: api
tags: [ses, email, prisma, server-action, html-escaping, aws-sdk]

# Dependency graph
requires:
  - phase: 34-schema-ses-infrastructure
    provides: BugReport Prisma model, SES email identity, env vars
provides:
  - submitBugReport server action (single entry point for bug report submission)
  - sendBugReportEmail function (rich HTML email via SES)
  - escapeHtml utility for XSS prevention in email content
  - BugReportEmailData TypeScript interface
affects: [35-02-PLAN, bug-report-ui]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-ses"]
  patterns: ["fire-and-forget email (try/catch around SES, success regardless)", "lazy SES client instantiation for testability", "HTML escaping for email content injection prevention"]

key-files:
  created:
    - server/actions/bug-reports.ts
    - lib/email/bug-report-email.ts
    - server/actions/__tests__/bug-reports.test.ts
    - lib/email/__tests__/bug-report-email.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Lazy SES client instantiation to avoid module-level constructor issues in test mocking"
  - "Class-based vi.mock for @aws-sdk/client-ses to satisfy constructor pattern"

patterns-established:
  - "Fire-and-forget email: DB save first, email attempt in try/catch, return success regardless"
  - "escapeHtml utility for all user-provided fields in email HTML"

requirements-completed: [SUB-02, SUB-04, EMAIL-01, EMAIL-02]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 35 Plan 01: Bug Report Submission Flow - Backend Summary

**submitBugReport server action with Prisma save, HTML-escaped SES email notification, and fire-and-forget error handling**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T17:11:39Z
- **Completed:** 2026-03-26T17:17:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Email template builder with full HTML escaping preventing XSS in all user-provided fields
- Rich HTML email with inline styles: red header banner, card layout, viewport metadata, dashboard link
- Server action saves bug report to DB then sends fire-and-forget email notification
- 26 total tests across both test files, all passing
- @aws-sdk/client-ses dependency installed

## Task Commits

Each task was committed atomically (TDD: test + feat per task):

1. **Task 1: Email template builder** - `ee571d4` (test: RED) + `fa990d1` (feat: GREEN) -- 17 tests
2. **Task 2: submitBugReport server action** - `b56d5b4` (test: RED) + `1a285d8` (feat: GREEN) -- 9 tests

## Files Created/Modified
- `lib/email/bug-report-email.ts` - Email template builder with escapeHtml, buildEmailHtml, sendBugReportEmail
- `lib/email/__tests__/bug-report-email.test.ts` - 17 tests for escaping, HTML output, SES send
- `server/actions/bug-reports.ts` - submitBugReport server action with auth, validation, Prisma save, email
- `server/actions/__tests__/bug-reports.test.ts` - 9 tests for DB save, auth, validation, fire-and-forget
- `package.json` - Added @aws-sdk/client-ses dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used lazy SES client instantiation (getter function) instead of module-level `new SESClient()` to avoid constructor issues during test mocking
- Used class-based mock for @aws-sdk/client-ses (vitest requires class/function for constructors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed SES client module-level instantiation breaking test mocks**
- **Found during:** Task 1 (email template implementation)
- **Issue:** Module-level `const ses = new SESClient(...)` ran before vi.mock factory could provide mockSend, causing "not a constructor" and "cannot access before initialization" errors
- **Fix:** Changed to lazy initialization via `getSesClient()` function that creates client on first call
- **Files modified:** lib/email/bug-report-email.ts
- **Verification:** All 17 email tests pass
- **Committed in:** fa990d1 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for testability. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required. SES infrastructure was set up in Phase 34.

## Known Stubs
None - all functions are fully implemented with real logic.

## Next Phase Readiness
- submitBugReport server action is ready for Plan 02's UI component to call
- BugReportEmailData interface exported for type reuse
- All tests passing, no regressions

---
*Phase: 35-bug-report-submission-flow*
*Completed: 2026-03-26*
