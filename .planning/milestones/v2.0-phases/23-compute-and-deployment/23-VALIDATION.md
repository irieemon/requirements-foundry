---
phase: 23
slug: compute-and-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (CDK infra tests) |
| **Config file** | `infra/jest.config.js` |
| **Quick run command** | `cd infra && npx jest --testPathPattern=requirements-foundry-stack` |
| **Full suite command** | `cd infra && npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd infra && npx jest --testPathPattern=requirements-foundry-stack`
- **After every plan wave:** Run `cd infra && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green + manual end-to-end validation on AWS
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | CMP-01 | unit (CDK assertion) | `cd infra && npx jest -t "TaskDefinition"` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | CMP-04 | unit (CDK assertion) | `cd infra && npx jest -t "LogGroup"` | ❌ W0 | ⬜ pending |
| 23-01-03 | 01 | 1 | AI-02 | unit (CDK assertion) | `cd infra && npx jest -t "Bedrock"` | ✅ | ⬜ pending |
| 23-02-01 | 02 | 1 | CMP-01 | manual | Docker build + run entrypoint locally | N/A | ⬜ pending |
| 23-03-01 | 03 | 2 | STOR-02 | manual | Upload document via browser, verify in S3 | N/A | ⬜ pending |
| 23-03-02 | 03 | 2 | STOR-03 | manual | Retrieve/delete file via browser | N/A | ⬜ pending |
| 23-03-03 | 03 | 2 | AI-01 | manual | Run card analysis in browser | N/A | ⬜ pending |
| 23-03-04 | 03 | 2 | AI-04 | manual | Verify Bedrock FTU form submitted | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add CDK assertions for FargateTaskDefinition (cpu=512, memory=1024) to `infra/test/requirements-foundry-stack.test.ts`
- [ ] Add CDK assertions for FargateService (desiredCount=1, securityGroups, subnets) to same file
- [ ] Add CDK assertions for CloudWatch LogGroup (`/ecs/requirements-foundry-prod`) to same file
- [ ] Add CDK assertion that container has port mapping 3000

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bedrock Claude invocation works end-to-end | AI-01 | Requires live AWS Bedrock access | Deploy app, run card analysis, verify AI-generated content |
| Bedrock FTU form submitted | AI-04 | AWS Console manual action | Check Bedrock > Model access in AWS Console for Claude Sonnet 4 |
| S3 upload via FormData from ECS | STOR-02 | Requires running ECS container with IAM role | Upload document via app UI, verify file appears in S3 bucket |
| S3 get/delete from ECS | STOR-03 | Requires running ECS container with IAM role | Retrieve and delete uploaded file via app UI |
| ALB serves app from corporate network | CMP-01 | Requires VPN + deployed service | Navigate to ALB URL from corporate network |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
