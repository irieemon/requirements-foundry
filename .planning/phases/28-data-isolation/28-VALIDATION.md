---
phase: 28
slug: data-isolation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing config) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | DATA-01 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "createProject"` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 1 | DATA-02 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProjects"` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 1 | DATA-03 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "getAuthorizedProject"` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | ADMIN-01 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "isAdmin"` | ❌ W0 | ⬜ pending |
| 28-01-05 | 01 | 1 | ADMIN-03 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -t "ADMIN_EMAIL"` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 2 | DATA-04 | manual | Verify via `prisma migrate deploy` on test DB | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/auth/__tests__/authorization.test.ts` — unit tests for isAdmin, getAuthorizedProject, getAuthorizedProjects
- [ ] Mock setup for `getCurrentUser()` and `db` (Prisma mock or vi.mock)

*Note: DATA-04 (migration) is manual-only — verify by checking DB state after migration.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration backfills NULL userId | DATA-04 | Requires live DB state verification | Run `prisma migrate deploy`, then `SELECT COUNT(*) FROM "Project" WHERE "userId" IS NULL` — expect 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
