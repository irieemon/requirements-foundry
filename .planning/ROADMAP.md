# Roadmap: Requirements Foundry

## Milestones

- ✅ [v1.0 Generative Pipeline Fix](milestones/v1.0-ROADMAP.md) (Phases 1-9) — SHIPPED 2026-01-15
- ✅ [v1.1 UX Polish](milestones/v1.1-ROADMAP.md) (Phases 10-12) — SHIPPED 2026-01-20
- ✅ [v1.2 MSS Integration](milestones/v1.2-ROADMAP.md) (Phases 13-17) — SHIPPED 2026-01-27
- ⏸️ **v1.3 Contextual Upload** - Phases 18-20 (paused for AWS migration)
- 🚧 **v2.0 AWS Migration** - Phases 21-25 (in progress)

## Overview

This milestone migrates Requirements Foundry from Vercel to AWS. The application code changes are narrow -- swap four Vercel-specific integrations (Blob storage, Anthropic SDK, Neon DB, serverless timeout workarounds) -- while the infrastructure work provisions a complete internal VPC deployment (ECS Fargate, RDS PostgreSQL, S3, Bedrock, ALB). Phases 21 and 22 can run in parallel since code changes have zero AWS dependency.

## Completed Milestones

<details>
<summary>v1.0 Generative Pipeline Fix (Phases 1-9) — SHIPPED 2026-01-15</summary>

- [x] **Phase 1: Investigation & Instrumentation** (2/2 plans) — completed 2026-01-13
- [x] **Phase 2: Card Analysis Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 3: Epic Generation Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 4: Story Generation Timeout Fix** (1/1 plan) — completed 2026-01-14
- [x] **Phase 5: Integration Verification** (2/2 plans) — completed 2026-01-15
- [x] **Phase 6: Stories Page** (1/1 plan) — completed 2026-01-14
- [x] **Phase 7: Subtask Generation** (5/5 plans) — completed 2026-01-14
- [x] **Phase 8: Subtask Viewing** (1/1 plan) — completed 2026-01-15
- [x] **Phase 9: Performance Optimization** (3/3 plans) — completed 2026-01-15

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.1 UX Polish (Phases 10-12) — SHIPPED 2026-01-20</summary>

- [x] Phase 10: Navigation & Layout (3/3 plans) — completed 2026-01-15
- [x] Phase 10.1: Upload Client Direct (1/1 plan) — completed 2026-01-16
- [x] Phase 10.2: KPI & Subtask UX (1/1 plan) — completed 2026-01-16
- [x] Phase 11: Data Display & Hierarchy (3/3 plans) — completed 2026-01-20
- [x] Phase 12: JIRA Export Preview (2/2 plans) — completed 2026-01-20

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.2 MSS Integration (Phases 13-17) — SHIPPED 2026-01-27</summary>

- [x] Phase 13: MSS Data Model & Import (1/1 plan) — completed 2026-01-20
- [x] Phase 14: MSS Management UI (3/3 plans) — completed 2026-01-20
- [x] Phase 15: MSS Mapping to Work Items (2/2 plans) — completed 2026-01-20
- [x] Phase 16: MSS Dashboard & Reporting (1/1 plan) — completed 2026-01-20
- [x] Phase 17: MSS Export Integration (1/1 plan) — completed 2026-01-27

See [v1.2 archive](milestones/v1.2-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.3 Contextual Upload (Phases 18-20) — PAUSED</summary>

- [x] Phase 18: Context Schema & Upload Form (1/1 plan) — completed 2026-01-27
- [ ] Phase 19: AI Question Generation (1/2 plans) — paused
- [ ] Phase 20: Context Integration (0/? plans) — not started

Paused at Phase 19 for AWS migration priority. Resume after v2.0 ships.

</details>

## Phases

### v2.0 AWS Migration

- [ ] **Phase 21: Application Code Migration** - Replace Vercel-specific integrations, Dockerize, eliminate self-continuation pattern
- [ ] **Phase 22: Infrastructure Foundation** - CDK project with VPC, networking, RDS, S3, IAM, secrets, ECR
- [ ] **Phase 23: Compute and Deployment** - Wire ECS Fargate service to infrastructure, deploy running application
- [ ] **Phase 24: CI/CD and Operations** - Automated deployments, stale run recovery, monitoring and alarms
- [ ] **Phase 25: Validation and Data Migration** - End-to-end smoke tests, database migration from Neon to RDS

## Phase Details

### Phase 21: Application Code Migration
**Goal**: The application runs in a Docker container with AWS service integrations (S3, Bedrock, standard PostgreSQL) and no Vercel dependencies
**Depends on**: Nothing (can run in parallel with Phase 22)
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06, CODE-07, CODE-08, AI-03
**Success Criteria** (what must be TRUE):
  1. `docker build` produces a working image and `docker run` starts the app on port 3000 with styled pages and static assets
  2. File upload uses S3 SDK calls (put, get, delete) instead of `@vercel/blob` -- verifiable by running with `MOCK_MODE` or local S3 (MinIO)
  3. AI provider calls use Bedrock SDK constructor and model ID format -- mock mode still works without any AWS credentials
  4. The fire-and-confirm HTTP self-trigger pattern is gone from all generative flows -- story/epic/subtask generation uses direct async calls
  5. No references to `@vercel/blob`, `@anthropic-ai/sdk`, `VERCEL_URL`, `BATCH_STORY_SECRET`, or `VERCEL_AUTOMATION_BYPASS_SECRET` remain in codebase
**Plans**: 4 plans
Plans:
- [ ] 21-01-PLAN.md — Package swap, Dockerfile, db.ts simplification, health check
- [ ] 21-02-PLAN.md — S3 storage adapter, Prisma column rename, upload flow migration
- [ ] 21-03-PLAN.md — Bedrock AI provider, credential auto-detection, document-analyzer/question-generator
- [ ] 21-04-PLAN.md — Self-continuation elimination, Vercel reference purge

### Phase 22: Infrastructure Foundation
**Goal**: All AWS infrastructure exists and is deployable via CDK -- networking, database, storage, secrets, and container registry are provisioned and correctly configured
**Depends on**: Nothing (can run in parallel with Phase 21)
**Requirements**: NET-01, NET-02, NET-03, NET-04, NET-05, NET-06, DB-01, DB-02, STOR-01, SEC-01, SEC-02, SEC-03, SEC-04, CMP-02, CMP-03, IAC-01, IAC-02
**Success Criteria** (what must be TRUE):
  1. `cdk deploy` provisions the full stack (VPC, subnets, NAT, ALB, RDS, S3, ECR, security groups, VPC endpoints) without errors
  2. RDS PostgreSQL instance is reachable from within the VPC private subnets (verified by connection test)
  3. S3 bucket exists with private-only access; ECR repository exists with lifecycle policy keeping last 10 images
  4. Security groups enforce the correct boundaries: ALB accepts corporate CIDR only, ECS accepts ALB only, RDS accepts ECS only
  5. Secrets Manager holds DATABASE_URL; SSM Parameter Store holds non-sensitive config (bucket name, region)
**Plans**: TBD

### Phase 23: Compute and Deployment
**Goal**: The application is running on ECS Fargate and accessible from the corporate network via the internal ALB
**Depends on**: Phase 21, Phase 22
**Requirements**: CMP-01, CMP-04, AI-01, AI-02, AI-04, STOR-02, STOR-03
**Success Criteria** (what must be TRUE):
  1. ECS Fargate task is running with the Docker image from Phase 21, using 0.5 vCPU / 1GB RAM, and stays healthy (ALB health checks pass)
  2. Navigating to the internal ALB URL from the corporate network loads the application homepage
  3. File upload via presigned URLs works end-to-end (upload a document, see it stored in S3, retrieve it)
  4. AI-powered generation (card analysis, epic generation) completes successfully using Bedrock Claude with IAM auth (no API keys)
**Plans**: TBD

### Phase 24: CI/CD and Operations
**Goal**: Deployments are automated via GitHub Actions, stale run recovery works without Vercel Cron, and basic operational monitoring is in place
**Depends on**: Phase 23
**Requirements**: CICD-01, CICD-02, CICD-03, CRON-01, OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. Pushing to `main` triggers a GitHub Actions workflow that builds, pushes to ECR, and deploys to ECS -- new code is live within minutes
  2. GitHub Actions authenticates to AWS via OIDC (no long-lived credentials stored in GitHub secrets)
  3. Stale run recovery executes periodically and cleans up stuck runs (verifiable by checking recovered run logs)
  4. CloudWatch alarms fire when ECS task count drops to 0 or ALB has unhealthy targets, and SNS delivers email notification
**Plans**: TBD

### Phase 25: Validation and Data Migration
**Goal**: All existing features work identically on AWS, and production data is migrated from Neon to RDS
**Depends on**: Phase 24
**Requirements**: DB-03, DB-04, VAL-01, VAL-02, VAL-03, VAL-04
**Success Criteria** (what must be TRUE):
  1. Full smoke test passes: upload document, analyze cards, generate epics, generate stories, generate subtasks, export to JIRA -- all on AWS
  2. MSS taxonomy import and mapping to epics/stories works correctly on AWS
  3. After `pg_dump`/`pg_restore` from Neon to RDS, all existing projects, cards, epics, stories, and subtasks are accessible
  4. Prisma migrations run cleanly against RDS and schema matches expectations
**Plans**: TBD

## Progress

**Execution Order:**
Phases 21 and 22 can run in parallel. Phase 23 depends on both. Then 24, then 25 sequentially.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Investigation & Instrumentation | v1.0 | 2/2 | Complete | 2026-01-13 |
| 2. Card Analysis Progress Fix | v1.0 | 1/1 | Complete | 2026-01-13 |
| 3. Epic Generation Progress Fix | v1.0 | 1/1 | Complete | 2026-01-13 |
| 4. Story Generation Timeout Fix | v1.0 | 1/1 | Complete | 2026-01-14 |
| 5. Integration Verification | v1.0 | 2/2 | Complete | 2026-01-15 |
| 6. Stories Page | v1.0 | 1/1 | Complete | 2026-01-14 |
| 7. Subtask Generation | v1.0 | 5/5 | Complete | 2026-01-14 |
| 8. Subtask Viewing | v1.0 | 1/1 | Complete | 2026-01-15 |
| 9. Performance Optimization | v1.0 | 3/3 | Complete | 2026-01-15 |
| 10. Navigation & Layout | v1.1 | 3/3 | Complete | 2026-01-15 |
| 10.1 Upload Client Direct | v1.1 | 1/1 | Complete | 2026-01-16 |
| 10.2 KPI & Subtask UX | v1.1 | 1/1 | Complete | 2026-01-16 |
| 11. Data Display & Hierarchy | v1.1 | 3/3 | Complete | 2026-01-20 |
| 12. JIRA Export Preview | v1.1 | 2/2 | Complete | 2026-01-20 |
| 13. MSS Data Model & Import | v1.2 | 1/1 | Complete | 2026-01-20 |
| 14. MSS Management UI | v1.2 | 3/3 | Complete | 2026-01-20 |
| 15. MSS Mapping to Work Items | v1.2 | 2/2 | Complete | 2026-01-20 |
| 16. MSS Dashboard & Reporting | v1.2 | 1/1 | Complete | 2026-01-20 |
| 17. MSS Export Integration | v1.2 | 1/1 | Complete | 2026-01-27 |
| 18. Context Schema & Upload Form | v1.3 | 1/1 | Complete | 2026-01-27 |
| 19. AI Question Generation | v1.3 | 1/2 | Paused | - |
| 20. Context Integration | v1.3 | 0/? | Paused | - |
| 21. Application Code Migration | 1/4 | In Progress|  | - |
| 22. Infrastructure Foundation | v2.0 | 0/? | Not started | - |
| 23. Compute and Deployment | v2.0 | 0/? | Not started | - |
| 24. CI/CD and Operations | v2.0 | 0/? | Not started | - |
| 25. Validation and Data Migration | v2.0 | 0/? | Not started | - |
