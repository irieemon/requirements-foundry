---
phase: 30
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.16 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run lib/auth/__tests__/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/auth/__tests__/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | DATA-01, DATA-02 | integration | `npx prisma validate && npx vitest run lib/auth/__tests__/project-share.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | DATA-01 | integration | `npx vitest run lib/auth/__tests__/user-upsert.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/auth/__tests__/project-share.test.ts` — stubs for DATA-02 (ProjectShare creation, cascade delete)
- [ ] `lib/auth/__tests__/user-upsert.test.ts` — stubs for DATA-01 (User upsert on login)

*Existing infrastructure covers test framework — vitest already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSO login creates User record | DATA-01 | Requires live Cognito callback | 1. Log in via SSO 2. Check User table for new record 3. Verify email and name populated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
