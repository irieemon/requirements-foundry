---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: AWS Migration
status: executing
stopped_at: "25-02-PLAN.md Task 2 checkpoint:human-action (data migration)"
last_updated: "2026-03-09T21:25:45Z"
last_activity: 2026-03-09 -- Neon-to-RDS migration script created (25-02)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 15
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** The application runs reliably on AWS infrastructure, accessible to internal corporate users, with all existing features working identically.
**Current focus:** v2.0 AWS Migration - Phase 25 IN PROGRESS (Validation and Data Migration)

## Current Position

Phase: 25 of 25 (Validation and Data Migration)
Plan: 2 of 3 in current phase (Plan 25-02 awaiting human action for data migration)
Status: Phase 25 In Progress
Last activity: 2026-03-09 -- Neon-to-RDS migration script created (25-02)

Progress: [█████████░] 93% (v2.0 Phases 21-24 complete, Phase 25 in progress)

## Milestones

- **v1.0** -- SHIPPED 2026-01-15 (Phases 1-9)
- **v1.1** -- SHIPPED 2026-01-20 (Phases 10-12)
- **v1.2** -- SHIPPED 2026-01-27 (Phases 13-17)
- **v1.3** -- PAUSED at Phase 19 (resume after v2.0)
- **v2.0** -- IN PROGRESS (Phases 21-25, Phases 21-23 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 15 (v2.0)
- Average duration: 3 min (automated plans)
- Total execution time: ~37 min + deployment debugging

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 21    | 01   | 3 min    | 2     | 7     |
| 21    | 02   | 4 min    | 2     | 5     |
| 21    | 03   | 2 min    | 2     | 3     |
| 21    | 04   | 5 min    | 2     | 13    |
| 21    | 05   | 1 min    | 2     | 3     |
| 22    | 01   | 6 min    | 2     | 7     |
| 22    | 02   | 3 min    | 2     | 2     |
| 22    | 03   | 2 min    | 2     | 2     |
| 23    | 01   | 2 min    | 2     | 2     |
| 23    | 02   | 2 min    | 2     | 6     |
| 23    | 03   | multi-session | 2 | 6   |
| 24    | 01   | 3 min    | 2     | 1     |
| 24    | 02   | 2 min    | 2     | 1     |
| 24    | 03   | multi-session | 2 | 1   |
| 25    | 01   | 83 min   | 2     | 2     |
| 25    | 02   | 2 min    | 1     | 1     |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Key decisions for v2.0 (full log in PROJECT.md):
- ECS Fargate for compute (containerized, Docker-ready)
- RDS PostgreSQL for database (standard managed PG)
- S3 for file storage (replaces @vercel/blob)
- Amazon Bedrock for AI (replaces direct Anthropic SDK)
- Internet-facing ALB (POC; switch to internal after VPN setup)
- GitHub Actions for CI/CD with OIDC auth
- CDK (TypeScript) for IaC
- Phases 21 and 22 can run in parallel
- [21-01] node:22-alpine for all Docker stages
- [21-01] Standardize on DATABASE_URL only (removed POSTGRES_URL fallback)
- [21-01] Health check aiEnabled uses MOCK_MODE flag instead of API key presence
- [21-02] getStorageMode() made async for credential auto-detection
- [21-02] S3 key format: uploads/{timestamp}-{filename}
- [21-02] Server-side FormData upload replaces client-side Vercel Blob upload
- [21-03] Factory functions (getAIProvider, getDocumentAnalyzer, getQuestionGenerator) are now async
- [21-03] Bedrock model ID format: anthropic.claude-sonnet-4-20250514-v1:0
- [21-03] AWS credential detection uses fromNodeProviderChain with module-level caching
- [21-04] Fire-and-forget executor calls from server actions with .catch() error logging
- [21-04] Subtask action uses IIFE wrapping executeSubtaskGeneration + finalizeSubtaskRun
- [21-04] Logger uses AWS_REGION/NODE_ENV instead of VERCEL_REGION/VERCEL_ENV
- [Phase 21]: Removed additional Vercel reference in heartbeat comment not identified in plan
- [22-01] Literal region us-east-1 in stack env for deterministic synth
- [22-01] S3 endpoint added to both PRIVATE_WITH_EGRESS and PRIVATE_ISOLATED subnets
- [22-01] Bedrock endpoint ServiceName resolves to literal string with concrete region
- [22-02] All stateful resources use RemovalPolicy.DESTROY for POC teardown
- [22-02] DATABASE_URL secret is a placeholder; composed at container startup (Phase 23)
- [22-02] CDK lifecycle policy serializes maxImageCount as countNumber in JSON
- [Phase 22]: [22-03] HTTP/80 listener with default 503 fixed response; Phase 23 switches to forwarding
- [Phase 22]: [22-03] Bedrock IAM policy uses resources: ['*'] (no resource-level permissions supported)
- [Phase 22]: [22-03] 14 CfnOutputs with rf-prod-* export names for cross-stack references
- [23-01] circuitBreaker rollback disabled for initial bootstrap (no image in ECR yet)
- [23-01] Container environment uses literal values for non-sensitive config (NODE_ENV, PORT, AWS_REGION)
- [23-02] require('./server.js') instead of exec to keep same process for SIGTERM handling
- [23-02] Migration failure is non-fatal -- log and continue for resilience
- [23-03] RDS force_ssl=1 requires pg adapter SSL: { rejectUnauthorized: false }
- [23-03] ALB switched to internet-facing (POC) -- no VPN/Direct Connect available
- [23-03] PrismaPg uses individual connection params (not URL) for reliable password handling
- [23-03] Custom RDS parameter group created with force_ssl=0 temporarily
- [23-03] rename_blob_to_storage migration rolled back; app works with original column names
- [24-02] Push to main triggers deploy -- no PR checks or approval gates
- [24-02] Workflow steps inline (not calling deploy.sh) -- deploy.sh remains for manual deploys
- [24-02] Uses aws ecs update-service --force-new-deployment (CDK-managed task def)
- [24-01] CDK FargateService uses minHealthyPercent/maxHealthyPercent props (not nested deploymentConfiguration)
- [24-01] ECS/ContainerInsights namespace for RunningTaskCount metric (not AWS/ECS)
- [24-01] Lambda calls internet-facing ALB directly (no VPC access needed)
- [24-01] dbInstance.metric() used for RDS CPU alarm (type-safe CDK pattern)
- [24-02] AWS_ACCOUNT_ID stored as GitHub repository secret for IAM role ARN
- [24-03] No alarmEmail provided -- SNS topic created without email subscription (add later)
- [24-03] GitHub AWS_ACCOUNT_ID repository secret confirmed set by user
- [25-01] CDK parameter group replaces manually-created parameter group from Phase 23
- [25-01] Application redeployment deferred to git push (Finch amd64 emulation too slow)
- [25-02] Strategy B: full dump from Neon, restore to RDS, Prisma applies rename on restart
- [25-02] pg_restore warnings about 'does not exist' treated as harmless (--clean --if-exists)

### Pending Todos

- Push to main to deploy entrypoint.js cleanup and trigger rename_blob_to_storage migration
- Verify container starts cleanly after push (no debug pg test output in logs)

### Blockers/Concerns

- Finch VM networking unreliable for cross-platform builds (amd64 on ARM)
- Corporate VPN routing to internal ALB not available (using internet-facing as workaround)

## Session Continuity

Last session: 2026-03-09T21:25:45Z
Stopped at: 25-02-PLAN.md Task 2 checkpoint:human-action (data migration from Neon to RDS)
Resume file: .planning/phases/25-validation-and-data-migration/25-02-SUMMARY.md
Next: User runs migration script with Neon credentials, then 25-03 (smoke testing)
