---
phase: 33
slug: projects-page-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run lib/auth/__tests__/authorization.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

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
| 33-01-01 | 01 | 1 | PAGE-01 | unit | `npx jest --testPathPattern="authorization" --no-coverage` | ✅ | ⬜ pending |
| 33-01-02 | 01 | 1 | PAGE-02, PAGE-03 | unit | `npx jest --testPathPattern="authorization" --no-coverage` | ✅ | ⬜ pending |
| 33-01-03 | 01 | 1 | PAGE-01 | manual | Visual verification of section layout | N/A | ⬜ pending |
| 33-02-01 | 02 | 1 | SC-04 | unit | `npx jest --testPathPattern="authorization" --no-coverage` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Authorization tests already exist in `lib/auth/__tests__/authorization.test.ts`. UI changes are primarily visual (React component updates) and verified through manual testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Shared with me" section visually separated from "My Projects" | PAGE-01 | Visual layout verification | Load projects page as user with shared projects; confirm two distinct sections |
| Role badge appears on shared project cards | PAGE-02 | Visual styling verification | Shared project cards show "Viewer" (outline) or "Editor" (secondary) badge |
| Owner display name on shared project cards | PAGE-03 | Visual content verification | Shared project cards show "Shared by {name}" subtitle |
| Runs from shared projects appear in runs list | SC-04 | Cross-page data verification | Navigate to runs page; confirm runs from shared projects appear with project name |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
