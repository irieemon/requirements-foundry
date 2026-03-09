---
phase: 22-infrastructure-foundation
plan: 02
subsystem: infra
tags: [cdk, rds, postgres, s3, ecr, ecs, secrets-manager, ssm, aws]

# Dependency graph
requires:
  - phase: 22-infrastructure-foundation
    plan: 01
    provides: VPC with 3 subnet tiers, 4 security groups, VPC endpoints
provides:
  - RDS PostgreSQL instance in isolated subnets with auto-generated credentials
  - S3 bucket with all public access blocked for file uploads
  - ECR repository with lifecycle policy keeping last 10 images
  - ECS cluster with container insights enabled
  - DATABASE_URL placeholder secret in Secrets Manager
  - 3 SSM parameters for non-sensitive config (bucket name, region, ECR repo URI)
  - CDK assertion tests for all data/storage/compute resources
affects: [22-03, 23-ecs-alb, 24-rds-s3, 25-cicd]

# Tech tracking
tech-stack:
  added: [aws-rds, aws-s3, aws-ecr, aws-ecs, aws-secretsmanager, aws-ssm]
  patterns: [RDS in isolated subnets with generated credentials, S3 BLOCK_ALL public access, ECR lifecycle policy, SSM for non-sensitive config]

key-files:
  created: []
  modified:
    - infra/lib/requirements-foundry-stack.ts
    - infra/test/requirements-foundry-stack.test.ts

key-decisions:
  - "CDK lifecycle policy serializes maxImageCount as countNumber in LifecyclePolicyText JSON"
  - "All stateful resources use RemovalPolicy.DESTROY for POC teardown"
  - "DATABASE_URL secret is a placeholder -- value composed at container startup or post-deploy"

patterns-established:
  - "Stateful resource naming: requirements-foundry-prod-{resource}"
  - "SSM parameter path: /requirements-foundry/prod/{param-name}"
  - "Secrets Manager path: requirements-foundry-prod/{secret-name}"

requirements-completed: [DB-01, DB-02, STOR-01, SEC-01, SEC-02, CMP-02, CMP-03]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 22 Plan 02: Data, Storage & Compute Foundation Summary

**RDS PostgreSQL db.t4g.micro in isolated subnets, S3 bucket with BLOCK_ALL, ECR repo with 10-image lifecycle, ECS cluster, Secrets Manager secrets, and 3 SSM parameters**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T23:46:01Z
- **Completed:** 2026-03-05T23:48:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- RDS PostgreSQL (db.t4g.micro, single-AZ) in isolated subnets with auto-generated credentials via Secrets Manager
- S3 bucket with all public access blocked, S3-managed encryption, auto-delete on destroy
- ECR repository with lifecycle policy keeping last 10 images, empty-on-delete enabled
- ECS cluster with container insights, DATABASE_URL placeholder secret, 3 SSM parameters
- 12 new CDK assertion tests (19 total) covering all data/storage/compute resources

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RDS, S3, ECR, ECS cluster, secrets, and SSM parameters** - `1a9776d` (feat)
2. **Task 2: Add CDK assertion tests for data/storage/compute resources** - `cda8171` (test)

## Files Created/Modified
- `infra/lib/requirements-foundry-stack.ts` - Added RDS, S3, ECR, ECS, Secrets Manager, SSM resources to stack
- `infra/test/requirements-foundry-stack.test.ts` - Added 12 new assertion tests for all data/storage/compute resources

## Decisions Made
- CDK serializes ECR lifecycle `maxImageCount` as `countNumber` in the LifecyclePolicyText JSON string -- test assertion uses `countNumber` pattern
- All stateful resources set to `RemovalPolicy.DESTROY` for POC teardown capability
- DATABASE_URL secret is a placeholder; actual value will be composed at container startup via entrypoint script (Phase 23)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ECR lifecycle policy test assertion pattern**
- **Found during:** Task 2 (CDK assertion tests)
- **Issue:** Plan suggested matching `"maxImageCount":10` in LifecyclePolicyText, but CDK serializes the lifecycle rule with `"countNumber":10` instead
- **Fix:** Changed test pattern from `"maxImageCount":10` to `"countNumber":10`
- **Files modified:** infra/test/requirements-foundry-stack.test.ts
- **Verification:** All 19 tests pass
- **Committed in:** cda8171 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test assertion fix. No scope creep.

## Issues Encountered
- `containerInsights` property on ECS Cluster emits a deprecation warning suggesting `containerInsightsV2` -- no action needed for POC, works correctly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All data/storage/compute foundation resources in place for Phase 22-03 (ALB, ECS service wiring)
- RDS credentials auto-generated in Secrets Manager, ready for ECS task definition reference
- S3 bucket and ECR repository ready for application deployment pipeline
- SSM parameters available for ECS container environment configuration

## Self-Check: PASSED

All 2 modified files verified present. Both task commits (1a9776d, cda8171) verified in git log.

---
*Phase: 22-infrastructure-foundation*
*Completed: 2026-03-05*
