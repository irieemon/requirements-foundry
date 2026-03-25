---
phase: 32
slug: share-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run server/actions/__tests__/shares.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/actions/__tests__/shares.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | SHARE-01 | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "shareProject"` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | SHARE-02 | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "searchUsers"` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | SHARE-03 | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "updateShareRole"` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | SHARE-03 | unit | `npx vitest run server/actions/__tests__/shares.test.ts -t "removeShare"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/actions/__tests__/shares.test.ts` — stubs for SHARE-01, SHARE-02, SHARE-03
- [ ] Mock pattern: follow `lib/auth/__tests__/authorization.test.ts` for mocking `server-only`, `@/lib/db`, `@/lib/auth`, `next/cache`

*Existing test infrastructure (Vitest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Share dialog opens from project page header | SHARE-01 | UI interaction in browser | Navigate to project, click Share button, verify dialog opens |
| User search combobox shows results | SHARE-02 | Requires browser interaction + visual check | Type in search field, verify dropdown shows matching users |
| Role change dropdown works inline | SHARE-03 | UI interaction + visual state | Change role in dropdown, verify immediate update |
| Remove confirmation dialog appears | SHARE-03 | UI interaction + visual check | Click remove, verify AlertDialog, confirm, verify removal |
| Share button hidden for non-owners | SHARE-01 | Requires different user login | Log in as editor/viewer, navigate to shared project, verify no Share button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
