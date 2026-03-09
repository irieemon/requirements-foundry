# Phase 25: Validation and Data Migration - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove all existing features work identically on AWS infrastructure, migrate data from Neon to RDS, and clean up technical debt from Phase 23. This is the final phase of v2.0 AWS Migration — successful completion means the milestone is shipped (after stakeholder demo).

</domain>

<decisions>
## Implementation Decisions

### Data migration approach
- Migrate data from Neon to RDS via pg_dump/pg_restore — data is test/demo, nice to have but not critical
- Apply the rename_blob_to_storage migration AFTER restore (blobUrl → storageUrl, blobPathname → storageKey)
- No file migration needed — Vercel Blob files are test data, fresh uploads on S3 are sufficient
- Plan should include clear step-by-step instructions for pg_dump/pg_restore (user may need to locate Neon credentials)
- If migration fails, starting fresh on RDS is acceptable — just ensure schema is correct

### Technical debt cleanup (before smoke test)
- Re-enable rds.force_ssl=1 in CDK parameter group and redeploy (lib/db.ts already has SSL configured)
- Remove debug pg connection test from entrypoint.js (lines 52-69)
- Remove migration resolve hack from entrypoint.js (lines 33-39) for the rolled-back rename migration
- Apply rename_blob_to_storage migration cleanly (after data restore or on fresh DB)
- Cleanup and redeploy BEFORE running smoke tests — smoke test validates the clean state

### Bedrock AI status
- Bedrock FTU form submitted and access approved — AI features should work
- AI-01 (model ID verification) and AI-04 (FTU form) can be marked complete during smoke test
- Smoke test must include AI-powered generation (card analysis, epic generation) to confirm Bedrock works

### Smoke test execution
- Manual walkthrough with step-by-step checklist — user walks through each feature in the browser
- Full flow: upload document → analyze cards → generate epics → generate stories → generate subtasks → JIRA export
- MSS flow: import MSS CSV (user has one) → map to epics/stories → verify dashboard
- JIRA export: verify export file generates correctly — no actual JIRA import test needed
- Plan should include a simple test document (e.g., sample requirements PDF) for the walkthrough
- Each checklist item is pass/fail with clear expected behavior

### Network access validation
- VAL-04 verified with workaround: ALB is internet-facing for POC, confirm app loads via ALB URL
- Switching to internal ALB deferred to production hardening (future milestone)
- Plan includes a connectivity check step before starting smoke test (user hasn't verified recently)

### Milestone completion
- v2.0 is shipped after: all VAL requirements pass + data migrated + stakeholder demo
- Stakeholder demo is required before calling the milestone complete

### Claude's Discretion
- pg_dump/pg_restore exact flags and connection parameters
- Test document content and format
- Smoke test checklist ordering and grouping
- How to verify schema correctness after migration
- Deploy script updates for cleanup changes

</decisions>

<specifics>
## Specific Ideas

- Cleanup first, validate second — smoke test proves the production-ready state, not the debug state
- Data migration is best-effort — if Neon access is problematic, starting fresh is fine
- Stakeholder demo after successful smoke test marks the milestone as shipped

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/deploy.sh`: Manual deploy script (build, push ECR, update ECS) — use for redeployment after cleanup
- `entrypoint.js`: Container startup with Secrets Manager + Prisma migrate — needs cleanup edits
- `lib/db.ts`: PrismaPg adapter with SSL configured (rejectUnauthorized: false) — ready for force_ssl=1
- `prisma/migrations/20260305000000_rename_blob_to_storage/migration.sql`: Column rename migration ready to apply

### Established Patterns
- CDK stack manages all infrastructure — force_ssl parameter change goes through CDK redeploy
- GitHub Actions CI/CD deploys on push to main — cleanup code changes auto-deploy after merge
- entrypoint.js runs Prisma migrate deploy on every container start — rename migration applies automatically

### Integration Points
- CDK `infra/lib/requirements-foundry-stack.ts`: RDS parameter group with force_ssl setting
- `entrypoint.js`: Debug code removal + migration resolve hack removal
- `prisma/migrations/`: rename_blob_to_storage migration needs clean state (not rolled-back)
- ALB URL from CloudFormation outputs: `rf-prod-alb-dns`

</code_context>

<deferred>
## Deferred Ideas

- Internal ALB switch — production hardening, requires VPN/Direct Connect setup
- Automated smoke test suite — could be valuable for future regressions, but manual is right for POC
- Okta SSO integration — documented in v2 requirements (AUTH-01 through AUTH-03)

</deferred>

---

*Phase: 25-validation-and-data-migration*
*Context gathered: 2026-03-09*
