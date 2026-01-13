# Phase 1 Plan 1: Investigation Mapping Summary

**Missing cache headers on batch-story endpoint is the root cause of "no progress" symptom; RunLogger exists but is never instantiated in any processing code.**

## Accomplishments

- Traced card analysis flow completely: `analyzeProject()` → `process-next-upload` continuation pattern → polling via `use-run-progress` hook
- Traced epic generation flow completely: `startGenerateAllStories()` → `process-next` loop pattern → polling via `use-batch-story-progress` hook
- Identified 9 instrumentation gaps with priority ratings
- Discovered RunLogger class (404 lines) exists in `lib/observability/logger.ts` but is never instantiated anywhere
- Found batch-story polling endpoint missing cache headers - browsers/CDNs may cache stale responses

## Files Analyzed

- `server/actions/analysis.ts` - Card analysis entry point, proper trigger error handling
- `server/actions/batch-stories.ts` - Epic generation entry point, already handles trigger failure
- `app/api/runs/[id]/process-next-upload/route.ts` - Continuation pattern, one upload per invocation
- `app/api/runs/[id]/process-next/route.ts` - Loop pattern, processes ALL epics in one invocation
- `app/api/runs/[id]/route.ts` - Card analysis polling, HAS correct cache headers
- `app/api/runs/[id]/batch-story/route.ts` - Epic polling, MISSING cache headers (key bug!)
- `hooks/use-run-progress.ts` - Frontend polling, 1s interval, terminal state detection
- `hooks/use-batch-story-progress.ts` - Frontend polling, 1s interval
- `lib/observability/logger.ts` - Comprehensive RunLogger class, never used
- `lib/observability/heartbeat.ts` - Stale detection logic, has outdated comments
- `lib/run-engine/process-next-trigger.ts` - Trigger functions with Vercel bypass support

## Key Findings

| Finding | Impact | Fix Priority |
|---------|--------|--------------|
| `batch-story/route.ts` missing cache headers | Root cause of "no progress" symptom | CRITICAL |
| RunLogger never instantiated | 50+ console.logs instead of structured logging | HIGH |
| AI call durations not tracked | Can't identify slow LLM calls | MEDIUM |
| `currentItemId`/`phaseDetail` sometimes null | Frontend can't show which item is processing | MEDIUM |
| heartbeat.ts has stale comments | Code claims heartbeatAt doesn't exist (it does) | LOW |

## Root Cause Hypotheses

1. **Card Analysis Frozen Progress**: Progress data IS being updated, but polling may be serving cached responses OR frontend isn't reflecting changes visually
2. **Epic Generation No Progress**: CONFIRMED - Missing cache headers on `batch-story/route.ts` causes CDN/browser caching of stale responses
3. **Story Generation Timeout**: Loop pattern processes ALL epics in one invocation - timeout occurs when total AI time exceeds 280s safety margin

## Next Step

Ready for 01-02-PLAN.md (Add Instrumentation) with specific targets:
1. Add cache headers to `batch-story/route.ts`
2. Replace console.log with RunLogger in both processing routes
3. Add AI call timing instrumentation
4. Ensure `currentItemId`/`phaseDetail` always populated
