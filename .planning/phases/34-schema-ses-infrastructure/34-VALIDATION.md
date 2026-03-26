---
phase: 34
slug: schema-ses-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (CDK tests) / Prisma CLI (migration tests) |
| **Config file** | `infra/jest.config.js` |
| **Quick run command** | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` |
| **Full suite command** | `cd infra && npx jest && cd .. && npx prisma validate` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd infra && npx jest --testPathPattern=requirements-foundry-stack`
- **After every plan wave:** Run `cd infra && npx jest && cd .. && npx prisma validate`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | INFRA-01 | schema | `npx prisma validate` | ✅ | ⬜ pending |
| 34-01-02 | 01 | 1 | INFRA-01 | migration | `npx prisma migrate dev --name add_bug_report` | ✅ | ⬜ pending |
| 34-02-01 | 02 | 1 | INFRA-02 | unit | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` | ✅ | ⬜ pending |
| 34-02-02 | 02 | 1 | INFRA-02 | unit | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SES email identity verified in AWS console | INFRA-02 | Requires AWS console action | Verify sender and admin emails in SES us-east-1 console |
| Environment variables visible to ECS task | INFRA-02 | Requires deployed environment | Check ECS task definition in AWS console after deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
