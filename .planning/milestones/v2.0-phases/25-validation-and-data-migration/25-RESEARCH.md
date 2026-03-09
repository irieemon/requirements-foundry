# Phase 25: Validation and Data Migration - Research

**Researched:** 2026-03-09
**Domain:** PostgreSQL data migration (pg_dump/pg_restore), CDK infrastructure updates, manual smoke testing
**Confidence:** HIGH

## Summary

Phase 25 is the final phase of v2.0 AWS Migration. It involves three distinct work streams: (1) technical debt cleanup from Phase 23 (re-enable SSL, remove debug code, apply the rename migration), (2) data migration from Neon to RDS via pg_dump/pg_restore, and (3) manual end-to-end smoke testing to validate all features work on AWS. The phase is primarily operational -- no new code features, just cleanup edits, database operations, and manual validation.

The code changes are small and well-defined: edit `entrypoint.js` to remove debug code (lines 33-39 and 52-69), add a CDK parameter group with `rds.force_ssl=1`, then deploy. The rename migration (`blobUrl` -> `storageUrl`, `blobPathname` -> `storageKey`) will apply automatically on next container start since `entrypoint.js` runs `prisma migrate deploy`. Data migration is best-effort -- if Neon access is problematic, a fresh RDS database with correct schema is acceptable.

**Primary recommendation:** Execute in strict order -- cleanup and deploy first, then data migration, then smoke test. The smoke test validates the production-ready state, not a debug state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Migrate data from Neon to RDS via pg_dump/pg_restore -- data is test/demo, nice to have but not critical
- Apply the rename_blob_to_storage migration AFTER restore (blobUrl -> storageUrl, blobPathname -> storageKey)
- No file migration needed -- Vercel Blob files are test data, fresh uploads on S3 are sufficient
- Plan should include clear step-by-step instructions for pg_dump/pg_restore (user may need to locate Neon credentials)
- If migration fails, starting fresh on RDS is acceptable -- just ensure schema is correct
- Re-enable rds.force_ssl=1 in CDK parameter group and redeploy (lib/db.ts already has SSL configured)
- Remove debug pg connection test from entrypoint.js (lines 52-69)
- Remove migration resolve hack from entrypoint.js (lines 33-39) for the rolled-back rename migration
- Apply rename_blob_to_storage migration cleanly (after data restore or on fresh DB)
- Cleanup and redeploy BEFORE running smoke tests -- smoke test validates the clean state
- Bedrock FTU form submitted and access approved -- AI features should work
- AI-01 (model ID verification) and AI-04 (FTU form) can be marked complete during smoke test
- Manual walkthrough with step-by-step checklist -- user walks through each feature in the browser
- Full flow: upload document -> analyze cards -> generate epics -> generate stories -> generate subtasks -> JIRA export
- MSS flow: import MSS CSV (user has one) -> map to epics/stories -> verify dashboard
- JIRA export: verify export file generates correctly -- no actual JIRA import test needed
- Plan should include a simple test document (e.g., sample requirements PDF) for the walkthrough
- Each checklist item is pass/fail with clear expected behavior
- VAL-04 verified with workaround: ALB is internet-facing for POC, confirm app loads via ALB URL
- Switching to internal ALB deferred to production hardening (future milestone)
- Plan includes a connectivity check step before starting smoke test
- v2.0 is shipped after: all VAL requirements pass + data migrated + stakeholder demo
- Stakeholder demo is required before calling the milestone complete

### Claude's Discretion
- pg_dump/pg_restore exact flags and connection parameters
- Test document content and format
- Smoke test checklist ordering and grouping
- How to verify schema correctness after migration
- Deploy script updates for cleanup changes

### Deferred Ideas (OUT OF SCOPE)
- Internal ALB switch -- production hardening, requires VPN/Direct Connect setup
- Automated smoke test suite -- could be valuable for future regressions, but manual is right for POC
- Okta SSO integration -- documented in v2 requirements (AUTH-01 through AUTH-03)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-03 | Database migrated from Neon to RDS via pg_dump/pg_restore | pg_dump/pg_restore patterns, column rename migration ordering, fallback to fresh DB |
| DB-04 | Prisma migrations run successfully against RDS instance | entrypoint.js cleanup enables clean migrate deploy, rename migration applies after restore |
| VAL-01 | End-to-end smoke test passes: upload, analyze, generate, export | Smoke test checklist with pass/fail criteria for each step |
| VAL-02 | MSS taxonomy import and mapping works on AWS | MSS CSV import checklist item, verify dashboard mapping |
| VAL-03 | All existing data accessible after database migration | Post-migration verification queries, schema match validation |
| VAL-04 | Application accessible from corporate network via internal ALB | ALB connectivity check (internet-facing POC workaround) |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| pg_dump | PostgreSQL 16 | Export data from Neon | Standard PostgreSQL backup tool, version should match source |
| pg_restore | PostgreSQL 16 | Import data into RDS | Standard PostgreSQL restore tool |
| AWS CDK | 2.x | Add parameter group for force_ssl | Already used for all infrastructure |
| Prisma | (project version) | Schema migration after restore | Already used for all DB migrations |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| psql | Verify schema/data post-migration | Run SELECT queries to check data integrity |
| aws cli | Get ALB URL, check ECS status, view logs | Connectivity check and deployment verification |
| deploy.sh | Manual deployment after cleanup | Rebuild and push container with cleanup changes |

## Architecture Patterns

### Migration Order (Critical)
```
1. Cleanup code changes (entrypoint.js edits + CDK parameter group)
2. Deploy cleanup (build, push ECR, update ECS + CDK deploy)
3. Verify container starts cleanly (check logs)
4. pg_dump from Neon (--data-only or full, depends on approach)
5. pg_restore into RDS
6. Rename migration applies automatically on next container restart
7. Verify data accessible
8. Run smoke test checklist
```

### Pattern: pg_dump/pg_restore for Cross-Host Migration
**What:** Export data from Neon PostgreSQL, import into RDS PostgreSQL
**When to use:** One-time migration between PostgreSQL instances
**Approach:**

There are two viable strategies given the situation (rename migration rolled back on Neon, pending on RDS):

**Strategy A: Schema-first, data-only restore (Recommended)**
```bash
# On Neon: dump data only (schema already managed by Prisma)
pg_dump "postgresql://user:pass@neon-host/db?sslmode=require" \
  --data-only \
  --no-owner \
  --no-privileges \
  --format=custom \
  -f neon_data.dump

# On RDS: ensure schema is current (Prisma migrate deploy has run)
# Then restore data only
pg_restore --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -h <rds-endpoint> -U postgres -d requirements_foundry \
  neon_data.dump
```

**Key consideration:** Neon's Upload table has `blobUrl`/`blobPathname` columns (initial migration), while RDS schema after rename migration has `storageUrl`/`storageKey`. A `--data-only` restore will fail on column name mismatch if the rename migration has already been applied.

**Strategy B: Full dump, then migrate (Safer for column mismatch)**
```bash
# Dump everything from Neon
pg_dump "postgresql://user:pass@neon-host/db?sslmode=require" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=custom \
  -f neon_full.dump

# Drop and recreate the database on RDS, then restore
pg_restore --no-owner --no-privileges --clean --if-exists \
  -h <rds-endpoint> -U postgres -d requirements_foundry \
  neon_full.dump

# Then run Prisma migrate deploy to apply rename migration
# (container restart does this automatically)
```

**Recommended: Strategy B** -- dump the full database from Neon (which has `blobUrl`/`blobPathname` columns in the schema), restore into RDS, then let Prisma apply the rename migration. This avoids column name mismatch issues.

### Pattern: CDK Parameter Group for force_ssl
**What:** Add a custom RDS parameter group to enforce SSL connections
**Code change in CDK stack:**
```typescript
// Add parameter group before dbInstance
const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_3 }),
  description: 'Requirements Foundry RDS parameter group',
  parameters: {
    'rds.force_ssl': '1',
  },
});

// Add to dbInstance props:
const dbInstance = new rds.DatabaseInstance(this, 'Database', {
  // ... existing props ...
  parameterGroup,  // Add this line
});
```

**Important:** Adding a parameter group to an existing RDS instance via CDK may trigger a reboot. The `rds.force_ssl` parameter is dynamic (applies without reboot on PostgreSQL), but CDK may still trigger one during the stack update. Plan for brief downtime.

### Anti-Patterns to Avoid
- **Testing before cleanup:** Smoke test must validate the clean, production-ready state, not the debug state with hack code
- **Restoring data before schema alignment:** If using `--data-only`, column names must match between dump and target schema
- **Skipping the Prisma migration_history table:** When doing full restore from Neon, the `_prisma_migrations` table comes along, which is correct -- it shows which migrations have been applied. The rename migration will then be applied on next `prisma migrate deploy`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database backup/restore | Custom SQL scripts | pg_dump/pg_restore | Handles sequences, constraints, types correctly |
| SSL enforcement | Manual pg_hba.conf | CDK parameter group with rds.force_ssl | Managed by RDS, survives reboots |
| Schema migration | Manual ALTER TABLE | Prisma migrate deploy | Tracks migration state, idempotent |
| Container redeployment | Manual docker commands on ECS | deploy.sh or GitHub Actions push | Handles ECR auth, tagging, ECS update |

## Common Pitfalls

### Pitfall 1: Column Name Mismatch During Restore
**What goes wrong:** pg_restore with `--data-only` fails because Neon has `blobUrl`/`blobPathname` but RDS schema (after rename migration) has `storageUrl`/`storageKey`
**Why it happens:** The rename migration was rolled back on Neon but is pending on RDS
**How to avoid:** Use full dump (Strategy B) which includes Neon's schema with original column names, then let Prisma apply the rename migration after restore
**Warning signs:** `ERROR: column "blobUrl" of relation "Upload" does not exist`

### Pitfall 2: Prisma Migration History Conflict
**What goes wrong:** After restoring Neon's `_prisma_migrations` table into RDS, Prisma sees the rename migration as "rolled-back" and refuses to apply it
**Why it happens:** Neon had the migration marked as rolled back (that's why the resolve hack exists in entrypoint.js)
**How to avoid:** After restore, before removing the resolve hack, either: (a) let the current entrypoint.js (with the hack) run once to resolve and re-apply, or (b) manually update the migration status in `_prisma_migrations` table
**Warning signs:** Prisma migrate deploy reports "Migration 20260305000000_rename_blob_to_storage has been rolled back"

### Pitfall 3: Neon Connection String Discovery
**What goes wrong:** User can't find Neon credentials to run pg_dump
**Why it happens:** Neon was set up during earlier development, credentials may be in .env.local, Neon dashboard, or Vercel environment variables
**How to avoid:** Plan should list multiple places to look: Neon dashboard (console.neon.tech), local .env/.env.local file, Vercel project settings
**Warning signs:** Authentication failures on pg_dump

### Pitfall 4: CDK Drift from Manual Changes
**What goes wrong:** CDK deploy fails or behaves unexpectedly because a custom parameter group was created manually (via Console/CLI) during Phase 23
**Why it happens:** CDK expects to manage all resources; manual changes cause drift
**How to avoid:** Check if a manual parameter group exists and is attached to the RDS instance. If so, CDK may need to import it or the manual one should be detached first. Alternatively, `cdk diff` before deploy to preview changes
**Warning signs:** CloudFormation UPDATE_ROLLBACK on parameter group resource

### Pitfall 5: Sequence Values After pg_restore
**What goes wrong:** Auto-increment sequences (if any) are not reset after data restore, causing duplicate key errors
**Why it happens:** pg_restore with `--data-only` doesn't restore sequences by default
**How to avoid:** This project uses CUID IDs (text), not auto-increment integers, so this is NOT a concern here. The only sequence-like value is the `version` field (integer with default 1) which is application-managed

## Code Examples

### entrypoint.js After Cleanup
```javascript
// Lines to REMOVE:
// Lines 33-39: Migration resolve hack
//   try {
//     execSync("node ./node_modules/prisma/build/index.js migrate resolve --rolled-back 20260305000000_rename_blob_to_storage", {
//       ...
//     });
//   } catch (e) { ... }

// Lines 52-69: Debug pg connection test
//   const { Pool } = require("pg");
//   try { ... pool.query("SELECT current_user...") ... } catch (pgErr) { ... }

// After cleanup, entrypoint.js should be:
// 1. Read secrets from Secrets Manager
// 2. Export DATABASE_URL
// 3. Run prisma migrate deploy
// 4. Start server via require('./server.js')
```

### Verify Schema After Migration
```sql
-- Check Upload table has renamed columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Upload' AND column_name IN ('storageUrl', 'storageKey', 'blobUrl', 'blobPathname');
-- Expected: storageUrl, storageKey (after rename migration)

-- Check data exists
SELECT COUNT(*) FROM "Project";
SELECT COUNT(*) FROM "Upload";
SELECT COUNT(*) FROM "Card";
SELECT COUNT(*) FROM "Epic";
SELECT COUNT(*) FROM "Story";
SELECT COUNT(*) FROM "Subtask";

-- Check migration history
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
-- Expected: initial = applied, rename_blob_to_storage = applied (not rolled back)
```

### Get ALB URL
```bash
aws cloudformation describe-stacks \
  --stack-name RequirementsFoundryStack \
  --query 'Stacks[0].Outputs[?ExportName==`rf-prod-alb-dns`].OutputValue' \
  --output text --region us-east-1
```

### Get RDS Endpoint
```bash
aws cloudformation describe-stacks \
  --stack-name RequirementsFoundryStack \
  --query 'Stacks[0].Outputs[?ExportName==`rf-prod-rds-endpoint`].OutputValue' \
  --output text --region us-east-1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| force_ssl=0 (temporary) | force_ssl=1 via CDK parameter group | Phase 25 | SSL enforced on all RDS connections |
| Debug pg test in entrypoint | Removed -- SSL works | Phase 25 | Cleaner startup, no debug noise |
| Migration resolve hack | Removed -- clean migration state | Phase 25 | Prisma migrate deploy works normally |
| blobUrl/blobPathname columns | storageUrl/storageKey columns | Phase 25 (rename migration) | Schema matches S3 storage adapter |

## Smoke Test Checklist (Recommended Structure)

### Pre-Flight
1. Get ALB URL and verify app loads in browser (VAL-04)
2. Check ECS task is running and healthy (CloudWatch logs clean)

### Core Flow (VAL-01)
3. Create a new project
4. Upload a test document (PDF or text)
5. Verify upload appears in project, file accessible
6. Run card analysis (AI-powered -- validates Bedrock/AI-01/AI-04)
7. Verify cards generated and displayed
8. Generate epics from cards
9. Verify epics displayed with correct structure
10. Generate stories for at least one epic
11. Verify stories displayed under epic
12. Generate subtasks for at least one story
13. Verify subtasks displayed under story
14. Export to JIRA format
15. Verify export file downloads correctly

### MSS Flow (VAL-02)
16. Import MSS taxonomy CSV
17. Verify service lines, areas, activities created
18. Map epics/stories to MSS service areas
19. Verify MSS assignments on dashboard

### Data Integrity (VAL-03) -- only if data migration performed
20. Navigate to existing projects (from Neon data)
21. Verify cards, epics, stories, subtasks from old data are accessible
22. Verify no broken references or missing relationships

## Open Questions

1. **CDK Parameter Group Drift**
   - What we know: Phase 23 created a custom parameter group with force_ssl=0, likely via AWS Console or CLI (not in CDK code)
   - What's unclear: Whether this manual parameter group is currently attached to the RDS instance, and whether CDK will conflict with it
   - Recommendation: Run `cdk diff` before deploying to check. If drift exists, may need to manually detach the old parameter group first or use CDK import

2. **Neon Credential Location**
   - What we know: User set up Neon earlier in development
   - What's unclear: Where credentials are stored (dashboard, .env.local, Vercel)
   - Recommendation: Plan should list multiple lookup locations; if not found, skip data migration and use fresh DB

3. **Migration History State on RDS**
   - What we know: The resolve hack in current entrypoint.js marks the rename migration as resolved on every start
   - What's unclear: Current state of `_prisma_migrations` table on RDS -- is the rename migration marked as applied, rolled-back, or absent?
   - Recommendation: Before removing the resolve hack, check the migration history on RDS. If the rename migration shows as rolled-back, either run the resolve hack one final time or manually update the record

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit), Playwright (e2e) |
| Config file | vitest.config.* (project root) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run && npm run test:e2e` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-03 | Data migrated from Neon to RDS | manual-only | N/A -- one-time operational task | N/A |
| DB-04 | Prisma migrations run against RDS | manual-only | N/A -- verified by container startup logs | N/A |
| VAL-01 | E2E smoke test (upload through export) | manual-only | N/A -- manual browser walkthrough per user decision | N/A |
| VAL-02 | MSS taxonomy import and mapping | manual-only | N/A -- manual browser walkthrough per user decision | N/A |
| VAL-03 | Existing data accessible after migration | manual-only | N/A -- manual SQL verification + browser check | N/A |
| VAL-04 | App accessible via ALB | manual-only | `curl -s -o /dev/null -w "%{http_code}" http://<alb-url>/api/health` | N/A |

**Note:** All Phase 25 requirements are operational/validation tasks. Per user decision, this is a manual walkthrough with checklist -- no automated test suite needed for POC.

### Sampling Rate
- **Per task commit:** `npm run test:run` (ensure no regressions from cleanup edits)
- **Per wave merge:** Full unit test suite
- **Phase gate:** Manual smoke test checklist all-pass

### Wave 0 Gaps
None -- Phase 25 is an operational phase. The cleanup code changes (entrypoint.js edits, CDK parameter group addition) should pass existing unit tests. No new test files needed.

## Sources

### Primary (HIGH confidence)
- Project source code: `entrypoint.js`, `lib/db.ts`, `prisma/schema.prisma`, CDK stack -- direct inspection of current state
- `25-CONTEXT.md` -- user decisions and constraints
- `STATE.md` -- accumulated project decisions and history
- `REQUIREMENTS.md` -- requirement definitions and traceability

### Secondary (MEDIUM confidence)
- PostgreSQL pg_dump/pg_restore behavior with column renames -- based on PostgreSQL documentation knowledge
- CDK parameter group behavior -- based on AWS CDK documentation knowledge

### Tertiary (LOW confidence)
- CDK drift behavior when manual parameter group exists -- exact behavior depends on how it was created in Phase 23

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools are standard PostgreSQL and AWS tooling already in use
- Architecture: HIGH -- migration order and strategies are well-understood from project history
- Pitfalls: HIGH -- identified from direct code inspection and understanding of Neon/RDS state differences
- Smoke test: HIGH -- user provided detailed checklist requirements

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no fast-moving dependencies)
