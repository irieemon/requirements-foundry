---
phase: 24-ci-cd-and-operations
plan: 02
subsystem: infra
tags: [github-actions, oidc, ecr, ecs, docker, ci-cd, arm64]

# Dependency graph
requires:
  - phase: 23-compute-and-deployment
    provides: "ECS service, ECR repository, task definition with ARM64 runtime"
  - phase: 24-ci-cd-and-operations plan 01
    provides: "OIDC IAM role for GitHub Actions (requirements-foundry-github-actions)"
provides:
  - "Automated build/push/deploy pipeline on push to main"
  - "GitHub Actions workflow at .github/workflows/deploy.yml"
affects: [25-monitoring-and-observability]

# Tech tracking
tech-stack:
  added: [github-actions, aws-actions/configure-aws-credentials@v4, aws-actions/amazon-ecr-login@v2]
  patterns: [oidc-auth-no-long-lived-credentials, push-to-main-deploy, force-new-deployment-for-cdk-managed-tasks]

key-files:
  created: [.github/workflows/deploy.yml]
  modified: []

key-decisions:
  - "Push to main triggers deploy -- no PR checks or approval gates"
  - "Workflow steps inline (not calling deploy.sh) -- deploy.sh remains for manual deploys"
  - "Uses aws ecs update-service --force-new-deployment (not amazon-ecs-deploy-task-definition) because task def is CDK-managed"
  - "AWS_ACCOUNT_ID stored as GitHub repository secret for IAM role ARN construction"

patterns-established:
  - "OIDC auth pattern: id-token: write permission + aws-actions/configure-aws-credentials with role-to-assume"
  - "ECS deploy pattern: force-new-deployment pulls latest image from ECR"

requirements-completed: [CICD-01]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 24 Plan 02: Deploy Workflow Summary

**GitHub Actions workflow automating Docker build/push to ECR and ECS rolling deployment on push to main via OIDC auth**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T15:49:10Z
- **Completed:** 2026-03-09T15:51:10Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created GitHub Actions deploy workflow triggered on push to main
- Configured OIDC authentication with no long-lived AWS credentials
- Docker build targets linux/arm64 matching ECS task definition runtime
- Validated workflow YAML syntax and structure programmatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions deploy workflow** - `3cd4340` (feat)
2. **Task 2: Validate workflow syntax** - no file changes (validation-only task, YAML confirmed valid)

**Plan metadata:** `dcf4ee8` (docs: complete plan)

## Files Created/Modified
- `.github/workflows/deploy.yml` - Automated build/push/deploy pipeline: checkout, OIDC auth, ECR login, Docker build (arm64), push, ECS force-new-deployment

## Decisions Made
- Push to main triggers deploy -- no PR checks or approval gates (per user constraints)
- Workflow steps inline rather than calling deploy.sh -- keeps deploy.sh for manual use
- Uses `aws ecs update-service --force-new-deployment` instead of `amazon-ecs-deploy-task-definition` action because task definition is CDK-managed
- `AWS_ACCOUNT_ID` stored as GitHub repository secret (needed to construct IAM role ARN)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `yaml` npm module not available for validation; used `js-yaml` (already in project dependencies) instead. Validation succeeded.

## User Setup Required

Before the workflow can execute:
1. Deploy OIDC IAM role via CDK (Plan 01)
2. Set `AWS_ACCOUNT_ID` as a GitHub repository secret

## Next Phase Readiness
- Deploy workflow ready to execute once OIDC IAM role is deployed (Plan 01) and AWS_ACCOUNT_ID secret is set in GitHub
- Phase 25 (Monitoring and Observability) can proceed independently

## Self-Check: PASSED

- FOUND: .github/workflows/deploy.yml
- FOUND: commit 3cd4340

---
*Phase: 24-ci-cd-and-operations*
*Completed: 2026-03-09*
