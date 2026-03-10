---
phase: 29
slug: admin-ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `vitest.config.mts`) |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | ADMIN-02 | unit | `npx vitest run lib/auth/__tests__/authorization.test.ts -x` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | UX-01 | unit | `npx vitest run components/layout/__tests__/user-menu.test.ts -x` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | UX-02 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/auth/__tests__/authorization.test.ts` — add tests for `getAuthorizedProjects(viewAll)` parameter behavior (covers ADMIN-02)
- [ ] `components/layout/__tests__/user-menu.test.ts` — unit test for `getInitials()` helper function (covers UX-01)

*Note: Vitest config `include` pattern is `**/*.test.ts` and environment is `node` — pure logic tests work fine without jsdom.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logout menu item navigates to `/api/auth/logout` | UX-02 | Requires browser navigation (`window.location.href`) which cannot be unit tested without jsdom | 1. Click user avatar in sidebar 2. Click "Log out" menu item 3. Verify redirect to login page |
| Admin toggle visibility | ADMIN-02 | UI rendering conditional on server-side admin flag | 1. Log in as admin user 2. Navigate to Projects page 3. Verify [My \| All] toggle visible 4. Log in as non-admin 5. Verify toggle not visible |
| User info display in sidebar | UX-01 | Visual rendering of initials avatar and name | 1. Log in 2. Verify initials avatar shows at sidebar bottom 3. Click avatar to open dropdown 4. Verify name, admin badge (if admin), and email displayed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
