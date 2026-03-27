---
phase: 36
slug: admin-bug-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vitest.config.mts) |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run server/actions/__tests__/bug-reports.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/actions/__tests__/bug-reports.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | ADMIN-01 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ✅ (extend) | ⬜ pending |
| 36-01-02 | 01 | 1 | ADMIN-02 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ✅ (extend) | ⬜ pending |
| 36-01-03 | 01 | 1 | ADMIN-03 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ✅ (extend) | ⬜ pending |
| 36-01-04 | 01 | 1 | ADMIN-04 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ✅ (extend) | ⬜ pending |
| 36-02-01 | 02 | 1 | ADMIN-01 | manual | Browser: navigate to /bug-reports, verify table renders | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 1 | ADMIN-02, ADMIN-03 | manual | Browser: expand row, change status, add notes, save | ❌ W0 | ⬜ pending |
| 36-02-03 | 02 | 1 | ADMIN-04 | manual | Browser: use status filter, verify table updates | ❌ W0 | ⬜ pending |
| 36-02-04 | 02 | 2 | ADMIN-05 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `server/actions/__tests__/bug-reports.test.ts` with test stubs for getBugReports, updateBugReport, getOpenBugReportCount
- [ ] Add mock for `isAdmin` from `lib/auth/authorization` in test file
- [ ] Add mock for `revalidatePath` from `next/cache` in test file

*Existing test infrastructure covers the framework and config. Only new test cases needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table renders with correct columns and data | ADMIN-01 | Visual layout verification | Navigate to /bug-reports as admin, verify columns: Status, Submitter, Date, Page URL, Description |
| Expandable row shows full details | ADMIN-01, ADMIN-03 | Interactive UI behavior | Click a row, verify expanded view with full description, browser metadata, status dropdown, notes textarea, Save button |
| Status change + notes save | ADMIN-02, ADMIN-03 | End-to-end mutation flow | Change status via dropdown, edit notes, click Save, verify toast and data persistence |
| Status filter works | ADMIN-04 | Client-side filter interaction | Select a status filter, verify table updates to show only matching reports |
| Sidebar badge shows open count | ADMIN-05 | Cross-component visual check | Verify badge appears in sidebar and mobile nav with correct open report count |
| Admin guard redirects non-admin | Security | Authorization boundary | Access /bug-reports as non-admin, verify redirect to /projects |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
