---
plan: 01-02
title: Add Instrumentation
status: complete
started: 2026-01-13T04:20:01Z
completed: 2026-01-13T04:45:00Z
duration_minutes: 25
commits:
  - a05a2c3: feat(01-02): add structured logging to card analysis processing
  - 648a852: feat(01-02): add structured logging to epic generation processing
  - 252d7b8: feat(01-02): add cache headers and debug logging to progress endpoints
---

# Plan 01-02 Summary: Add Instrumentation

## What Was Done

Added comprehensive structured logging and observability to all three generative flows using the existing RunLogger infrastructure, plus fixed the root cause cache header issue.

### Task 1: Card Analysis Logging
- Added RunLogger to `server/actions/analysis.ts` for run creation and trigger events
- Replaced all console.log in `app/api/runs/[id]/process-next-upload/route.ts` with structured logging
- Updated `finalizeRun` helper to accept logger parameter and call `logger.runCompleted()`

### Task 2: Epic Generation Logging
- Added RunLogger to `server/actions/batch-stories.ts` for run creation and trigger events
- Replaced all console.log in `app/api/runs/[id]/process-next/route.ts` with structured logging
- Updated `finalizeRun` helper with same pattern as card analysis

### Task 3: Cache Headers and Debug Logging
- **Root cause fix**: Added missing cache headers to `batch-story/route.ts`
- Added debug logging showing `status`, `phase`, and progress counts to both progress endpoints
- Ensured cache headers apply to all responses (200, 404, 500)
- Standardized `CACHE_HEADERS` constant pattern

## Key Observations

1. **RunLogger was already comprehensive** - The existing `lib/observability/logger.ts` had all necessary methods; they just weren't being used
2. **Cache header inconsistency** - The card analysis endpoint had cache headers, but batch-story endpoint did not (root cause of "no progress" symptom)
3. **Console.log was everywhere** - Both processing routes used `console.log` instead of structured logging

## Files Modified

| File | Changes |
|------|---------|
| `server/actions/analysis.ts` | +RunLogger for run creation |
| `app/api/runs/[id]/process-next-upload/route.ts` | Full structured logging |
| `server/actions/batch-stories.ts` | +RunLogger for run creation |
| `app/api/runs/[id]/process-next/route.ts` | Full structured logging |
| `app/api/runs/[id]/batch-story/route.ts` | +Cache headers, +debug logging |
| `app/api/runs/[id]/route.ts` | +Debug logging, standardized headers |

## Verification

- Build passed: `npm run build` completed successfully
- No type errors introduced
- All three commits atomic and self-contained

## Next Steps

Ready for Phase 1, Plan 3 (01-03): Enable Vercel Logging to actually capture these logs in production.
