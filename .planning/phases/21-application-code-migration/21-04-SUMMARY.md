---
phase: 21-application-code-migration
plan: 04
subsystem: run-engine
tags: [server-actions, executor, fire-and-forget, vercel-removal, docker]

# Dependency graph
requires:
  - phase: 21-02
    provides: S3 storage adapter replacing @vercel/blob
  - phase: 21-03
    provides: Async getAIProvider/hasAwsCredentials replacing Anthropic SDK
provides:
  - Direct fire-and-forget executor calls from all server actions
  - Subtask executor without timeout/continuation pattern
  - Zero Vercel references remaining in codebase
  - Clean heartbeat recovery via direct executor calls
affects: [22-infrastructure, 23-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget executor calls, direct async execution]

key-files:
  created: []
  modified:
    - server/actions/analysis.ts
    - server/actions/batch-stories.ts
    - server/actions/subtasks.ts
    - lib/run-engine/subtask-executor.ts
    - lib/run-engine/batch-story-executor.ts
    - lib/run-engine/executor.ts
    - lib/observability/heartbeat.ts
    - lib/observability/logger.ts
    - app/api/cron/recover-stale-runs/route.ts

key-decisions:
  - "Fire-and-forget pattern using .catch() for background error logging only"
  - "Subtask executor wraps executeSubtaskGeneration + finalizeSubtaskRun in IIFE"
  - "Logger uses AWS_REGION instead of VERCEL_REGION, x-trace-id instead of x-vercel-trace"

patterns-established:
  - "Fire-and-forget: executor(runId).catch(err => console.error(...))"
  - "No timeout in executors -- Docker containers run to completion"

requirements-completed: [CODE-05, CODE-07]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 21 Plan 04: HTTP Trigger Elimination Summary

**Direct fire-and-forget executor calls in all server actions, process-next trigger/routes deleted, zero Vercel references remaining**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T19:27:32Z
- **Completed:** 2026-03-05T19:32:09Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- All three server actions (analysis, batch-stories, subtasks) call executors directly with fire-and-forget pattern
- Deleted process-next-trigger.ts, both process-next API routes, and vercel.json
- Removed timeout/continuation pattern from subtask executor
- Updated heartbeat recovery to use direct executeBatchStoryRun call
- Purged all VERCEL_URL, BATCH_STORY_SECRET, VERCEL_AUTOMATION_BYPASS_SECRET, maxDuration exports
- Updated all executor files to use async getAIProvider() and getDocumentAnalyzer()

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace HTTP triggers with direct executor calls** - `90495ff` (feat)
2. **Task 2: Delete trigger files/routes, clean heartbeat, purge Vercel references** - `ee48400` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `server/actions/analysis.ts` - Direct executeRun() fire-and-forget call
- `server/actions/batch-stories.ts` - Direct executeBatchStoryRun() fire-and-forget call
- `server/actions/subtasks.ts` - Direct executeSubtaskGeneration + finalizeSubtaskRun IIFE
- `lib/run-engine/subtask-executor.ts` - Removed timeout, async getAIProvider/hasAwsCredentials
- `lib/run-engine/batch-story-executor.ts` - Async getAIProvider/hasAwsCredentials
- `lib/run-engine/executor.ts` - Async getDocumentAnalyzer
- `lib/observability/heartbeat.ts` - Direct executeBatchStoryRun for stale recovery
- `lib/observability/logger.ts` - AWS_REGION replaces VERCEL_REGION
- `app/api/cron/recover-stale-runs/route.ts` - Removed maxDuration, runtime, Vercel comments
- `vercel.json` - Deleted
- `lib/run-engine/process-next-trigger.ts` - Deleted
- `app/api/runs/[id]/process-next/route.ts` - Deleted
- `app/api/runs/[id]/process-next-upload/route.ts` - Deleted

## Decisions Made
- Fire-and-forget pattern with `.catch()` for error logging -- server actions return immediately with run ID
- Subtask server action uses IIFE wrapping executeSubtaskGeneration + finalizeSubtaskRun since both need sequential calling
- Logger environment detection switched from VERCEL_ENV/VERCEL_REGION to NODE_ENV/AWS_REGION
- Trace header switched from x-vercel-trace to x-trace-id

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated getDocumentAnalyzer() to async in executor.ts**
- **Found during:** Task 1
- **Issue:** executor.ts was calling getDocumentAnalyzer() synchronously, but Plan 03 made it async
- **Fix:** Added await to getDocumentAnalyzer() call
- **Files modified:** lib/run-engine/executor.ts
- **Committed in:** 90495ff (Task 1 commit)

**2. [Rule 2 - Missing Critical] Cleaned VERCEL_ENV/VERCEL_REGION from logger.ts**
- **Found during:** Task 2 (Vercel purge)
- **Issue:** Logger used VERCEL_ENV and VERCEL_REGION for environment/region detection
- **Fix:** Replaced with NODE_ENV and AWS_REGION
- **Files modified:** lib/observability/logger.ts
- **Committed in:** ee48400 (Task 2 commit)

**3. [Rule 2 - Missing Critical] Deleted vercel.json**
- **Found during:** Task 2 (Vercel purge)
- **Issue:** vercel.json with maxDuration config still existed
- **Fix:** Deleted the file
- **Committed in:** ee48400 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness and complete Vercel removal. No scope creep.

## Deferred Items

- `server/actions/generation.ts` still references `hasAnthropicKey()` (lines 5, 67, 203) -- not in this plan's scope
- `lib/batch-stories/__tests__/generate-all-stories.test.ts` mocks `hasAnthropicKey` -- test fixture, not in scope

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All application code is now free of Vercel dependencies
- Ready for Docker containerization (Phase 22) and infrastructure deployment
- TypeScript compilation and test verification deferred (no test runner available in current environment)

---
*Phase: 21-application-code-migration*
*Completed: 2026-03-05*
