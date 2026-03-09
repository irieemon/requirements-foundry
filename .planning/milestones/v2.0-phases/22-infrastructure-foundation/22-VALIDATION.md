---
phase: 22
slug: infrastructure-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | CDK assertions (`aws-cdk-lib/assertions`) + Jest |
| **Config file** | `infra/jest.config.js` (auto-created by `cdk init`) |
| **Quick run command** | `cd infra && npx jest --testPathPattern=test` |
| **Full suite command** | `cd infra && npx jest && npx cdk synth --quiet` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd infra && npx cdk synth --quiet && npx jest`
- **After every plan wave:** Run `cd infra && npx jest && npx cdk synth --quiet`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 0 | IAC-01 | smoke | `cd infra && npx cdk synth --quiet` | No -- Wave 0 | pending |
| 22-01-02 | 01 | 0 | IAC-02 | unit | `cd infra && npx jest` | No -- Wave 0 | pending |
| 22-02-01 | 02 | 1 | NET-01 | unit (CDK assertion) | `cd infra && npx jest -t "VPC"` | No -- Wave 0 | pending |
| 22-02-02 | 02 | 1 | NET-03 | unit (CDK assertion) | `cd infra && npx jest -t "NAT"` | No -- Wave 0 | pending |
| 22-02-03 | 02 | 1 | NET-04 | unit (CDK assertion) | `cd infra && npx jest -t "SecurityGroup"` | No -- Wave 0 | pending |
| 22-02-04 | 02 | 1 | NET-05 | unit (CDK assertion) | `cd infra && npx jest -t "S3Endpoint"` | No -- Wave 0 | pending |
| 22-02-05 | 02 | 1 | NET-06 | unit (CDK assertion) | `cd infra && npx jest -t "BedrockEndpoint"` | No -- Wave 0 | pending |
| 22-03-01 | 03 | 1 | DB-01 | unit (CDK assertion) | `cd infra && npx jest -t "RDS"` | No -- Wave 0 | pending |
| 22-03-02 | 03 | 1 | DB-02 | unit (CDK assertion) | `cd infra && npx jest -t "RDS"` | No -- Wave 0 | pending |
| 22-03-03 | 03 | 1 | SEC-01 | unit (CDK assertion) | `cd infra && npx jest -t "Secret"` | No -- Wave 0 | pending |
| 22-04-01 | 04 | 1 | STOR-01 | unit (CDK assertion) | `cd infra && npx jest -t "S3"` | No -- Wave 0 | pending |
| 22-04-02 | 04 | 1 | CMP-02 | unit (CDK assertion) | `cd infra && npx jest -t "Cluster"` | No -- Wave 0 | pending |
| 22-04-03 | 04 | 1 | CMP-03 | unit (CDK assertion) | `cd infra && npx jest -t "ECR"` | No -- Wave 0 | pending |
| 22-04-04 | 04 | 1 | SEC-02 | unit (CDK assertion) | `cd infra && npx jest -t "SSM"` | No -- Wave 0 | pending |
| 22-05-01 | 05 | 2 | NET-02 | unit (CDK assertion) | `cd infra && npx jest -t "ALB"` | No -- Wave 0 | pending |
| 22-05-02 | 05 | 2 | SEC-03 | unit (CDK assertion) | `cd infra && npx jest -t "SecurityGroup"` | No -- Wave 0 | pending |
| 22-05-03 | 05 | 2 | SEC-04 | unit (CDK assertion) | `cd infra && npx jest -t "SSM"` | No -- Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `infra/` directory -- CDK project scaffolding via `cdk init app --language typescript`
- [ ] `infra/jest.config.js` -- Jest config (auto-created by `cdk init`)
- [ ] `infra/test/requirements-foundry-stack.test.ts` -- CDK assertion test stubs for all resources

*Wave 0 is Plan 01 — CDK project initialization.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `cdk deploy` succeeds | IAC-02 | Requires AWS credentials and real provisioning | `cd infra && npx cdk deploy --require-approval never` |
| RDS reachable from VPC | DB-01 | Requires deployed infrastructure + bastion/jump host | Connect from ECS task or bastion in private subnet |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
