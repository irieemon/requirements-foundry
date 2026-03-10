---
phase: 26
slug: cognito-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via ts-jest, already configured in infra/) |
| **Config file** | `infra/jest.config.js` |
| **Quick run command** | `cd infra && npx jest --testPathPattern cognito` |
| **Full suite command** | `cd infra && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd infra && npx jest`
- **After every plan wave:** Run `cd infra && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | INFRA-01 | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests | ⬜ pending |
| 26-01-02 | 01 | 1 | INFRA-02 | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests | ⬜ pending |
| 26-01-03 | 01 | 1 | INFRA-02 | unit (Lambda handler) | `cd infra && npx jest --testPathPattern pre-token` | ❌ W0 | ⬜ pending |
| 26-01-04 | 01 | 1 | INFRA-03 | unit (CDK assertions) | `cd infra && npx jest --testPathPattern requirements-foundry-stack` | Existing file, needs new tests | ⬜ pending |
| 26-02-01 | 02 | 2 | INFRA-01 | manual-only | Test via Cognito Hosted UI URL in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `infra/test/pre-token-generation.test.ts` — unit tests for PreTokenGeneration Lambda handler (covers INFRA-02 logic)
- [ ] Update `infra/test/requirements-foundry-stack.test.ts` — add CDK assertions for Cognito resources (UserPool, domain, SAML IdP, client, Lambda trigger, Secrets Manager secret, CfnOutputs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SAML login end-to-end | INFRA-01 | Requires live Okta app and browser interaction | 1. Open CognitoHostedUiUrl from CDK outputs. 2. Click "Okta" to initiate SAML flow. 3. Authenticate with Okta credentials. 4. Verify redirect to callback URL with authorization code. 5. Decode JWT tokens and verify email and groups claims. |
| PreTokenGeneration Lambda execution | INFRA-02 | Requires live SAML assertion from Okta | 1. After SAML login, decode ID token. 2. Verify `cognito:groups` claim contains expected Okta groups. 3. Check CloudWatch logs for Lambda execution. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
