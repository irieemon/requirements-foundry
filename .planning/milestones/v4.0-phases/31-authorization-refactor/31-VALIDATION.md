---
phase: 31
slug: authorization-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run lib/auth/__tests__/authorization.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/auth/__tests__/authorization.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | AUTH-01, AUTH-03 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "resolveRole"` | Extend existing | ⬜ pending |
| 31-01-02 | 01 | 1 | AUTH-01 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProject"` | Extend existing | ⬜ pending |
| 31-01-03 | 01 | 1 | AUTH-01 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProjects"` | Extend existing | ⬜ pending |
| 31-02-01 | 02 | 1 | AUTH-02 | unit | `npx vitest run server/actions/__tests__/viewer-guards.test.ts` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | AUTH-01 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedRun"` | Extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `lib/auth/__tests__/authorization.test.ts` — add mocks for `db.user.findUnique` and `project.shares`, add test stubs for resolveRole, viewer guards, shared project listing
- [ ] Create `server/actions/__tests__/viewer-guards.test.ts` — stubs for viewer mutation rejection tests
- [ ] Add `db.user` mock to existing test setup (currently only mocks `db.project`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No inline `project.userId` checks remain outside lib/auth/ | AUTH-01 | Pattern verification via grep | Run `grep -r "project.userId !== user.email" --include="*.ts" app/ server/` — must return 0 results |
| API route polling returns correct HTTP status | AUTH-01 | Depends on Next.js runtime behavior | Test polling endpoints with unauthorized user via browser/curl |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
