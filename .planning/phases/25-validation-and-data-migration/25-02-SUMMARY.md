---
phase: 25-validation-and-data-migration
plan: 02
subsystem: database
tags: [postgresql, pg_dump, pg_restore, neon, rds, migration, bash]

requires:
  - phase: 25-01
    provides: "CDK parameter group for force_ssl, clean entrypoint.js"
  - phase: 22-infrastructure-foundation
    provides: "RDS instance, Secrets Manager credentials, CloudFormation outputs"
provides:
  - "Reusable Neon-to-RDS data migration script with pg_dump/pg_restore"
  - "Verification queries for post-migration schema and data checks"
affects: [25-validation-and-data-migration]

tech-stack:
  added: []
  patterns: ["pg_dump/pg_restore with --clean --if-exists for idempotent restore"]

key-files:
  created:
    - scripts/migrate-neon-to-rds.sh
  modified: []

key-decisions:
  - "Strategy B: full dump from Neon, restore to RDS, let Prisma apply rename migration on container restart"
  - "pg_restore warnings about 'does not exist' treated as harmless (--clean --if-exists pattern)"

patterns-established:
  - "Migration scripts fetch AWS credentials inline via CloudFormation + Secrets Manager"

requirements-completed: [DB-03, DB-04, VAL-03]

duration: 2min
completed: 2026-03-09
---

# Phase 25 Plan 02: Data Migration Summary

**Neon-to-RDS migration script using pg_dump/pg_restore with automatic AWS credential retrieval and dry-run support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T21:23:45Z
- **Completed:** 2026-03-09T21:25:45Z
- **Tasks:** 1 of 2 (Task 2 is human-action checkpoint)
- **Files modified:** 1

## Accomplishments
- Created reusable migration script at scripts/migrate-neon-to-rds.sh
- Script auto-fetches RDS endpoint and credentials from AWS (CloudFormation + Secrets Manager)
- Includes --dry-run flag for safe previewing before execution
- Handles pg_restore non-zero exit codes gracefully (distinguishes real errors from harmless warnings)
- Provides verification queries and next-step instructions inline

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data migration script** - `cf3f0b0` (feat)

**Task 2: Execute data migration** - checkpoint:human-action (awaiting user)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `scripts/migrate-neon-to-rds.sh` - Shell script for Neon-to-RDS data migration via pg_dump/pg_restore

## Decisions Made
- Strategy B chosen: full dump from Neon, restore to RDS, then Prisma applies rename migration on next container restart
- pg_restore warnings about "does not exist" on DROP are treated as harmless (expected with --clean --if-exists)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Human action required for Task 2: User must locate Neon connection string and run the migration script. See checkpoint details for full instructions.

## Next Phase Readiness
- Migration script ready for execution
- User needs to provide Neon credentials and run the script
- After migration (or skip), ECS container restart applies rename migration
- Plan 25-03 (smoke testing) follows after data migration verification

---
*Phase: 25-validation-and-data-migration*
*Completed: 2026-03-09*
