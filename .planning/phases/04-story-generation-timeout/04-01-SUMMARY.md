# Phase 4 Plan 1: Story Generation Timeout Fix Summary

**Self-continuation on timeout + fire-and-confirm trigger pattern**

## Accomplishments

- Added self-continuation when `process-next` times out at 280s (triggers next invocation immediately instead of waiting for 5-min cron)
- Fixed server action timeout by implementing "fire-and-confirm" pattern in `triggerProcessNextAsync`
- Applied same pattern to `triggerProcessNextUploadAsync` for consistency

## Files Created/Modified

- `app/api/runs/[id]/process-next/route.ts` - Self-continuation on timeout (from previous session)
- `lib/run-engine/process-next-trigger.ts` - Fire-and-confirm pattern with 10s AbortController timeout

## Root Causes Fixed

1. **Server action timeout**: `triggerProcessNextAsync` awaited full response from `process-next` (up to 280s), causing 300s timeout before it could return success. Fixed with abort-based early return.

2. **Stale run detection race**: When processing exceeded 280s, route left run in RUNNING state and relied on 5-min cron. Frontend's 2-min stale threshold would mark it FAILED first. Fixed with immediate self-continuation.

## Decisions Made

- Used AbortController with 10s timeout for fire-and-confirm (enough time to catch immediate errors like 401/404/500)
- Treat AbortError as success (request accepted, processing in background)

## Issues Encountered

- Initial implementation only addressed continuation, not the trigger timeout
- Discovered actual failure point through Vercel logs showing 300s timeout on server action

## Next Step

Phase 4 complete. Ready for Phase 5: Integration Verification.
