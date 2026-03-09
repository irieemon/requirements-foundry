---
phase: 24
slug: ci-cd-and-operations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | CDK synth + manual smoke tests (infrastructure deployment phase) |
| **Config file** | infra/cdk.json |
| **Quick run command** | `cd infra && npx cdk synth --quiet` |
| **Full suite command** | `cd infra && npx cdk synth && npx cdk diff` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd infra && npx cdk synth --quiet`
- **After every plan wave:** Run `cd infra && npx cdk synth && npx cdk diff`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | CICD-02 | unit | `cd infra && npx cdk synth --quiet` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | CRON-01 | unit | `cd infra && npx cdk synth --quiet` | ❌ W0 | ⬜ pending |
| 24-01-03 | 01 | 1 | OPS-02 | unit | `cd infra && npx cdk synth --quiet` | ❌ W0 | ⬜ pending |
| 24-01-04 | 01 | 1 | OPS-03 | unit | `cd infra && npx cdk synth --quiet` | ❌ W0 | ⬜ pending |
| 24-01-05 | 01 | 1 | CICD-03 | unit | `cd infra && npx cdk synth --quiet` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | CICD-01 | smoke | Push commit, verify ECS deployment | N/A | ⬜ pending |
| 24-02-02 | 02 | 1 | CICD-02 | smoke | Verify workflow uses OIDC (no secrets) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `cd infra && npx cdk synth --quiet` passes before adding new constructs
- [ ] Confirm CDK project compiles with existing dependencies

*Existing infrastructure covers framework needs — no new test frameworks required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push to main triggers deploy | CICD-01 | Requires actual GitHub push + ECS observation | 1. Push commit to main 2. Check Actions tab for workflow run 3. Verify new ECS deployment started |
| OIDC auth works | CICD-02 | Requires AWS account + GitHub repo config | 1. Verify workflow uses `role-to-assume` 2. Confirm no AWS keys in GitHub secrets |
| Stale run recovery fires | CRON-01 | Requires deployed Lambda + EventBridge | 1. Wait 5 min after deploy 2. Check Lambda CloudWatch logs for invocation 3. Verify HTTP 200 response |
| Alarms fire on breach | OPS-02 | Requires actual metric breach or test alarm | 1. Run `aws cloudwatch set-alarm-state --alarm-name rf-prod-ecs-no-running-tasks --state-value ALARM --state-reason "Test"` 2. Check email |
| SNS email delivery | OPS-03 | Requires email confirmation + alarm trigger | 1. Confirm SNS subscription email 2. Trigger test alarm 3. Verify email received |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
