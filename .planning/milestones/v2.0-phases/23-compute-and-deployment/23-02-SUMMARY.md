---
phase: 23-compute-and-deployment
plan: 02
subsystem: infra
tags: [docker, ecs, secrets-manager, prisma, deploy-script, entrypoint]

# Dependency graph
requires:
  - phase: 22-infrastructure-foundation
    provides: ECR repo, ECS cluster/service, RDS secret, ALB target group, IAM roles
  - phase: 21-application-containerization
    provides: Dockerfile multi-stage build, standalone Next.js output
provides:
  - Container entrypoint with Secrets Manager credential retrieval and Prisma migration
  - Production Dockerfile with entrypoint.js CMD and Prisma CLI
  - Manual deploy script for ECR push and ECS force-deploy
  - next.config.ts outputFileTracingIncludes for Secrets Manager SDK
affects: [23-compute-and-deployment, 24-ci-cd]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-secrets-manager"]
  patterns: [entrypoint-secret-composition, deploy-script-workflow]

key-files:
  created: [entrypoint.js, scripts/deploy.sh]
  modified: [Dockerfile, next.config.ts, package.json, package-lock.json]

key-decisions:
  - "require('./server.js') instead of exec to keep same process for SIGTERM handling"
  - "Migration failure is non-fatal -- log and continue for resilience"

patterns-established:
  - "Entrypoint pattern: secret retrieval -> env composition -> migration -> app start"
  - "Deploy script pattern: build -> ECR auth -> tag -> push -> ECS force-deploy"

requirements-completed: [STOR-02, STOR-03]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 23 Plan 02: Container Entrypoint, Dockerfile, and Deploy Script Summary

**Node.js entrypoint composing DATABASE_URL from Secrets Manager, running Prisma migrations at startup, with ECR/ECS deploy script**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T00:35:21Z
- **Completed:** 2026-03-06T00:37:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created entrypoint.js that reads RDS credentials from Secrets Manager, composes DATABASE_URL with encodeURIComponent, runs prisma migrate deploy, and starts server via require
- Updated Dockerfile to use entrypoint.js CMD, copy Prisma CLI and engines for runtime migrations
- Created executable deploy.sh script with build, ECR push, and ECS force-deploy workflow with monitoring commands
- Added outputFileTracingIncludes and serverExternalPackages for Secrets Manager SDK in next.config.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entrypoint.js and install Secrets Manager SDK** - `efe08b7` (feat)
2. **Task 2: Update Dockerfile and create deploy script** - `081b667` (feat)

## Files Created/Modified
- `entrypoint.js` - Container entrypoint: Secrets Manager -> DATABASE_URL -> prisma migrate -> server.js
- `Dockerfile` - Updated runner stage with entrypoint.js, Prisma CLI, engines, migrations; CMD changed
- `scripts/deploy.sh` - Manual deploy: docker build, ECR push, ECS force-deploy with monitoring output
- `next.config.ts` - Added outputFileTracingIncludes and serverExternalPackages for Secrets Manager SDK
- `package.json` - Added @aws-sdk/client-secrets-manager dependency
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used `require('./server.js')` instead of `exec` to keep the same process for proper SIGTERM/graceful shutdown handling (per research anti-patterns)
- Migration failure is non-fatal: logs error and continues, since migrations may already be applied or not exist yet
- Copied Prisma CLI and @prisma/engines into runner stage explicitly (standalone output does not trace them)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Container is ready to be built and deployed via `scripts/deploy.sh`
- Phase 23 Plan 01 (CDK task definition and Fargate service) must be completed for ECS deployment target
- Bedrock FTU form must be submitted before AI feature validation

---
*Phase: 23-compute-and-deployment*
*Completed: 2026-03-05*
