---
phase: 35
slug: bug-report-submission-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.16 |
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
| 35-01-01 | 01 | 1 | SUB-02, SUB-04, EMAIL-01 | unit | `npx vitest run server/actions/__tests__/bug-reports.test.ts` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | EMAIL-02 | unit | `npx vitest run lib/email/__tests__/bug-report-email.test.ts` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 2 | SUB-01 | manual | Visual check in browser | N/A | ⬜ pending |
| 35-02-02 | 02 | 2 | SUB-03 | manual | Visual check in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/actions/__tests__/bug-reports.test.ts` — stubs for SUB-02, SUB-04, EMAIL-01 (server action saves to DB, calls email, handles SES failure gracefully)
- [ ] `lib/email/__tests__/bug-report-email.test.ts` — stubs for EMAIL-02 (email HTML contains all required fields, HTML-escapes user input)
- [ ] Install `@aws-sdk/client-ses` — blocking dependency for email feature

*Framework already configured — vitest 4.0.16 with vitest.config.mts*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FAB visible on authenticated pages | SUB-01 | Visual/layout verification | Navigate to any authenticated page, verify bug icon in bottom-right corner |
| Success toast after submission | SUB-03 | UI animation/notification | Submit a bug report, verify toast appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
