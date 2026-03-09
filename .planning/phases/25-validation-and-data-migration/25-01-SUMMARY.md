---
phase: 25-validation-and-data-migration
plan: 01
subsystem: infra
tags: [entrypoint, cdk, rds, force-ssl, parameter-group, cleanup]

# Dependency graph
requires:
  - phase: 23-compute-and-deployment
    provides: Running ECS service with entrypoint.js and CDK stack
  - phase: 24-ci-cd-and-operations
    provides: CDK operational infrastructure (alarms, OIDC, cron)
provides:
  - Clean entrypoint.js without debug code or migration hacks
  - CDK-managed RDS parameter group with rds.force_ssl=1
  - SSL enforcement on RDS via CDK (replacing manual parameter group)
affects: [25-02, 25-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [CDK-managed RDS parameter groups replace manual AWS console changes]

key-files:
  created: []
  modified:
    - entrypoint.js
    - infra/lib/requirements-foundry-stack.ts

key-decisions:
  - "CDK parameter group replaces manually-created parameter group from Phase 23"
  - "Application redeployment deferred to git push (Finch amd64 emulation too slow for local Docker builds)"

patterns-established:
  - "RDS parameter group managed by CDK, not manual console changes"

requirements-completed: [DB-04]

# Metrics
duration: 83min
completed: 2026-03-09
---

# Phase 25 Plan 01: Technical Debt Cleanup Summary

**Removed entrypoint.js debug code (pg test, migration resolve hack) and added CDK-managed RDS parameter group with rds.force_ssl=1**

## Performance

- **Duration:** 83 min (CDK deploy ~3 min, Docker build timeout ~70 min)
- **Started:** 2026-03-09T19:10:33Z
- **Completed:** 2026-03-09T20:33:00Z
- **Tasks:** 1.5 of 2 (Task 2 partially complete -- CDK deployed, app deploy pending)
- **Files modified:** 2

## Accomplishments
- Removed migration resolve hack for rolled-back rename_blob_to_storage migration from entrypoint.js
- Removed debug pg connection test (Pool/query) from entrypoint.js
- Added CDK ParameterGroup with rds.force_ssl=1 attached to RDS DatabaseInstance
- Successfully deployed CDK stack to AWS (parameter group created and attached to RDS)
- Entrypoint.js now has clean 4-step flow: secrets -> DATABASE_URL -> migrate -> server

## Task Commits

Each task was committed atomically:

1. **Task 1: Clean up entrypoint.js and add CDK parameter group** - `3c6c64b` (feat)
2. **Task 2: Deploy cleanup changes to AWS** - CDK deployed successfully; application Docker build/push pending (Finch too slow, git push needs auth)

## Files Created/Modified
- `entrypoint.js` - Cleaned up to 4-step flow: read secrets, export DATABASE_URL, run prisma migrate deploy, start server
- `infra/lib/requirements-foundry-stack.ts` - Added DatabaseParameterGroup with rds.force_ssl=1 and attached to DatabaseInstance

## Decisions Made
- CDK parameter group replaces the manually-created parameter group from Phase 23 (which had force_ssl=0 temporarily)
- Application redeployment deferred to git push to main (triggers GitHub Actions CI/CD) because local Finch amd64 emulation build takes 30+ minutes and did not complete

## Deviations from Plan

None - plan executed as written for Task 1. Task 2 CDK deployment succeeded. Application deployment was attempted via local deploy script but blocked by Finch amd64 emulation performance (known issue documented in STATE.md blockers).

## Issues Encountered
- **Finch amd64 emulation timeout:** Docker builds via Finch with `--platform linux/amd64` on ARM Mac take 30+ minutes for npm ci step alone. Multiple attempts did not complete within reasonable time. This is a known issue (documented in STATE.md: "Finch VM networking unreliable for cross-platform builds").
- **Git push auth:** `git push origin main` failed with "could not read Username" -- GitHub HTTPS credentials not configured in osxkeychain. GitHub CLI (gh) not installed.
- **Vitest ESM error:** `npm run test:run` fails with ERR_REQUIRE_ESM (pre-existing, not caused by changes). CDK tests run separately via jest (3 pre-existing failures unrelated to this plan).

## User Setup Required

To complete the application deployment, the user must do ONE of:
1. **Push to main** to trigger GitHub Actions CI/CD: `git push origin main` (after configuring GitHub credentials)
2. **Wait for Finch build** to complete: run `./scripts/deploy.sh` and wait ~30-45 minutes
3. After push/deploy, verify with: `aws logs tail /ecs/requirements-foundry-prod --region us-east-1 --since 5m --no-cli-pager | head -30`

Expected clean logs: "Starting entrypoint...", "DATABASE_URL composed from Secrets Manager", "Running prisma migrate deploy...", "Migrations complete", "Starting server..." -- NO "pg connection test" output.

## Next Phase Readiness
- CDK infrastructure updated and deployed (parameter group with force_ssl=1)
- Code changes committed and ready for deployment via git push
- Once deployed, rename_blob_to_storage migration will apply automatically (resolve hack removed)
- Ready for Plan 25-02 (data migration) after application redeployment confirms clean startup

## Self-Check: PASSED

- FOUND: entrypoint.js (no debug code)
- FOUND: infra/lib/requirements-foundry-stack.ts (rds.force_ssl=1)
- FOUND: 25-01-SUMMARY.md
- FOUND: commit 3c6c64b

---
*Phase: 25-validation-and-data-migration*
*Completed: 2026-03-09*
