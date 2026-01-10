# Codebase Concerns

**Analysis Date:** 2026-01-09

## Tech Debt

**JSON Parsing Without Error Handling:**
- Issue: Multiple `JSON.parse()` calls without try/catch throughout codebase
- Files:
  - `app/api/runs/[id]/process-next/route.ts:119, 184, 186`
  - `app/api/runs/[id]/process-next-upload/route.ts`
  - `app/runs/[id]/page.tsx`
  - `lib/ai/document-analyzer.ts:141`
  - `lib/ai/provider.ts` (multiple locations)
  - `lib/run-engine/executor.ts:63`
  - `lib/run-engine/batch-story-executor.ts:68`
- Why: Fast prototyping, trusting database integrity
- Impact: Unhandled errors crash requests if database contains malformed JSON
- Fix approach: Add try/catch with structured error responses, consider Zod validation

**Console Statements in Production:**
- Issue: 50+ console.log/console.error calls in production code
- Files:
  - `app/api/runs/[id]/process-next/route.ts:39, 44, 60, 69, 143, 163, 196, 260, 280, 297`
  - `lib/storage/index.ts:25`
  - `lib/run-engine/process-next-trigger.ts:52, 53, 64`
- Why: Development debugging left in place
- Impact: Cluttered production logs, inconsistent logging format
- Fix approach: Replace with structured logger from `lib/observability/logger.ts`

**Placeholder Tests:**
- Issue: Test file contains only skeleton/TODO implementations
- Files: `lib/batch-stories/__tests__/generate-all-stories.test.ts:142, 153, 164` (535 lines)
- Why: Test framework set up but implementations not completed
- Impact: Zero test coverage for critical batch story generation feature
- Fix approach: Implement actual tests for happy path, error scenarios, retry logic

## Known Bugs

**None explicitly documented in code**

## Security Considerations

**Hardcoded Dev Secret Fallback:**
- Risk: Production deployments without `BATCH_STORY_SECRET` use insecure default
- File: `lib/run-engine/process-next-trigger.ts:37`
- Current code: `process.env.BATCH_STORY_SECRET || "dev-batch-secret-not-for-production"`
- Impact: Unauthenticated internal API calls possible, allowing arbitrary batch operations
- Recommendations: Remove fallback entirely, fail loudly if secret not set in production

**Missing CRON_SECRET Documentation:**
- Risk: Cron endpoint may be misconfigured
- File: `app/api/cron/recover-stale-runs/route.ts:31`
- Current mitigation: Secret validation in code
- Recommendations: Add `CRON_SECRET` to `.env.example` with documentation

## Performance Bottlenecks

**No Critical Bottlenecks Detected**

- Database queries appear reasonably optimized with indexes
- Prisma `findFirst` with orderBy for stale detection - `lib/observability/heartbeat.ts:49-66`
- Consider compound index on (runId, completedAt) if performance degrades with scale

## Fragile Areas

**Fire-and-Forget Continuation Pattern:**
- File: `lib/run-engine/process-next-trigger.ts:47-68`
- Why fragile: `fetch().catch()` silently swallows errors, no retry mechanism
- Common failures: Network errors, timeout, target endpoint unavailable
- Safe modification: Add exponential backoff retry, structured error logging
- Test coverage: None - relies on cron job recovery every 5 minutes

**Run Engine State Machine:**
- Files: `lib/run-engine/executor.ts`, `lib/run-engine/batch-story-executor.ts`
- Why fragile: Multiple state transitions (QUEUED → RUNNING → SUCCEEDED/FAILED)
- Common failures: Partial updates, race conditions on concurrent requests
- Safe modification: Use database transactions for state changes
- Test coverage: Minimal - placeholder tests only

## Scaling Limits

**Vercel Serverless:**
- Current capacity: 300s max function duration
- Limit: Long-running operations must use continuation pattern
- Symptoms at limit: Function timeout, incomplete processing
- Scaling path: Continuation pattern already implemented

**File Upload Size:**
- Current capacity: 4MB request body limit (next.config.ts), 100MB PPTX file limit (lib/documents/types.ts)
- Limit: Mismatch between request body size and file size limits
- Symptoms at limit: 413 Payload Too Large for files >4MB
- Scaling path: Align limits or implement chunked uploads

## Dependencies at Risk

**None Critical**

- All major dependencies current as of January 2025
- `@anthropic-ai/sdk` v0.71.2 - Active development
- `@prisma/client` v7.2.0 - Active development
- `next` v16.1.1 - Latest stable

## Missing Critical Features

**User Authentication:**
- Problem: No user authentication system
- Current workaround: Single-tenant, anyone with URL can access
- Blocks: Multi-tenancy, data isolation, audit trails
- Implementation complexity: Medium (integrate NextAuth or Clerk)

**Error Monitoring:**
- Problem: No error tracking service (Sentry, Rollbar)
- Current workaround: Console logs, manual monitoring
- Blocks: Proactive issue detection, error aggregation, alerting
- Implementation complexity: Low (add Sentry SDK)

## Test Coverage Gaps

**Batch Story Generation:**
- What's not tested: Full batch story flow (happy path, failures, retries)
- File: `lib/batch-stories/__tests__/generate-all-stories.test.ts` (placeholder only)
- Risk: Regressions in critical feature go undetected
- Priority: High
- Difficulty to test: Need to mock AI provider, database, timing

**Run Engine Continuation:**
- What's not tested: Continuation pattern, timeout recovery, state transitions
- Files: `lib/run-engine/executor.ts`, `lib/run-engine/process-next-trigger.ts`
- Risk: Silent failures in background processing
- Priority: High
- Difficulty to test: Need to mock fetch, timing, database state

**Document Extraction Error Handling:**
- What's not tested: Extraction failures for various file types
- Files: `lib/documents/extractors/*.ts`
- Risk: Unhandled edge cases crash requests
- Priority: Medium
- Difficulty to test: Need malformed test files for each format

---

*Concerns audit: 2026-01-09*
*Update as issues are fixed or new ones discovered*
