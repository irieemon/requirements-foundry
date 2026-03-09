---
phase: 21-application-code-migration
plan: 01
subsystem: infra
tags: [docker, aws-sdk, bedrock, s3, next-standalone, prisma]

# Dependency graph
requires: []
provides:
  - Multi-stage Dockerfile for standalone Next.js on node:22-alpine
  - AWS SDK packages (S3, Bedrock, credential-providers) in package.json
  - Standalone output mode in next.config.ts
  - Simplified database connection (DATABASE_URL only, no Vercel SSL)
  - AWS-oriented health check endpoint
affects: [21-02, 21-03, 22-infrastructure-as-code]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/credential-providers", "@anthropic-ai/bedrock-sdk"]
  removed: ["@vercel/blob", "@anthropic-ai/sdk"]
  patterns: [standalone-next-docker, standard-pg-connection]

key-files:
  created: [Dockerfile, .dockerignore]
  modified: [package.json, package-lock.json, next.config.ts, lib/db.ts, app/api/health/route.ts]

key-decisions:
  - "Use node:22-alpine for all Dockerfile stages (consistent, small image)"
  - "Remove POSTGRES_URL fallback -- standardize on DATABASE_URL only"
  - "Health check uses MOCK_MODE flag instead of ANTHROPIC_API_KEY presence for aiEnabled"

patterns-established:
  - "Docker multi-stage: deps -> builder -> runner with non-root user"
  - "DATABASE_URL as sole connection string env var"

requirements-completed: [CODE-03, CODE-04, CODE-06, CODE-08]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 21 Plan 01: Foundation & Dependencies Summary

**AWS SDK packages installed, Vercel packages removed, multi-stage Dockerfile created, db.ts simplified to standard PG connection, health check updated to AWS env vars**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T19:14:50Z
- **Completed:** 2026-03-05T19:17:55Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Swapped Vercel/Anthropic packages for AWS SDK equivalents (S3, Bedrock, credential-providers)
- Created production-ready multi-stage Dockerfile with standalone Next.js output
- Simplified lib/db.ts to use DATABASE_URL only, removing Vercel SSL detection logic
- Updated health check to use AWS_REGION and MOCK_MODE instead of Vercel env vars
- Enabled standalone output mode in next.config.ts for Docker compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Package dependencies and next.config.ts standalone mode** - `d22efeb` (feat)
2. **Task 2: Dockerfile, .dockerignore, db.ts simplification, and health check** - `7cef2b1` (feat)

## Files Created/Modified
- `Dockerfile` - Multi-stage build: deps, builder, runner on node:22-alpine
- `.dockerignore` - Excludes node_modules, .next, .git, .env*, .planning, *.md, .claude
- `package.json` - Added AWS SDKs, removed @vercel/blob and @anthropic-ai/sdk
- `package-lock.json` - Updated lockfile
- `next.config.ts` - Added output: "standalone", removed Vercel comments
- `lib/db.ts` - Simplified to standard PrismaPg with DATABASE_URL only
- `app/api/health/route.ts` - AWS_REGION, MOCK_MODE, NODE_ENV instead of Vercel vars

## Decisions Made
- Used node:22-alpine for all Docker stages for consistency and small image size
- Removed POSTGRES_URL fallback to standardize on DATABASE_URL only
- Health check aiEnabled uses MOCK_MODE flag rather than checking for specific API key presence
- Kept Prisma binary target hint (PRISMA_CLI_QUERY_ENGINE_TYPE=binary) in builder stage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compilation shows expected errors in `app/api/uploads/get-upload-url/route.ts` due to removed @vercel/blob package -- this file will be migrated in Plan 02 (file storage migration). Pre-existing implicit any type errors also present in several files. Both are out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Package foundation ready for Plans 02 (file storage) and 03 (AI provider) to build on
- Dockerfile ready for infrastructure plan (Phase 22) to use in ECS task definition
- TypeScript errors from @vercel/blob removal expected and will resolve when Plan 02 migrates storage

---
*Phase: 21-application-code-migration*
*Completed: 2026-03-05*
