---
phase: 27
slug: auth-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | AUTH-01 | unit | `npx vitest run lib/auth/__tests__/cognito.test.ts -t "authorize"` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | AUTH-03 | unit | `npx vitest run lib/auth/__tests__/session.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-03 | 01 | 1 | AUTH-04 | unit | `npx vitest run lib/auth/__tests__/cognito.test.ts -t "logout"` | ❌ W0 | ⬜ pending |
| 27-01-04 | 01 | 1 | AUTH-05 | unit | `npx vitest run __tests__/proxy.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | AUTH-02 | smoke | Manual (visual) or Playwright | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/auth/__tests__/cognito.test.ts` — stubs for AUTH-01, AUTH-04 (URL construction)
- [ ] `lib/auth/__tests__/session.test.ts` — stubs for AUTH-03 (session helpers)
- [ ] `__tests__/proxy.test.ts` — stubs for AUTH-05 (route protection logic)
- [ ] Vitest config `include` pattern update to cover `lib/auth/__tests__` and root `__tests__`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Landing page renders sign-in button | AUTH-02 | Visual layout verification | Visit `/`, confirm centered card with "Sign in with Okta" button, no AppShell |
| End-to-end SSO flow | AUTH-01 | Requires live Cognito + Okta | Click sign-in, verify redirect to Okta, verify callback and session creation |
| Session persistence across tabs | AUTH-03 | Browser behavior | Open authenticated tab, open new tab to same URL, verify session present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
