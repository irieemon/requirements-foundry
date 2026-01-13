# Discovery: Progress Flow Investigation

**Date:** 2026-01-13
**Phase:** 01-investigation-instrumentation
**Plan:** 01

## Executive Summary

Both generative flows (card analysis and epic/story generation) have the same core architecture pattern:
1. Server Action creates Run → triggers processing endpoint
2. Processing endpoint executes work → updates database → triggers continuation
3. Frontend polls progress endpoint → displays status

**Key Finding:** The `RunLogger` class exists in `lib/observability/logger.ts` with comprehensive structured logging methods, but it is **never instantiated** in either processing endpoint. All logging uses raw `console.log` statements.

---

## 1. Card Analysis Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CARD ANALYSIS PROGRESS FLOW                              │
└─────────────────────────────────────────────────────────────────────────────────┘

  User Click                 Server Action                   Database
      │                          │                              │
      ▼                          ▼                              ▼
┌──────────┐           ┌────────────────────┐         ┌─────────────────┐
│ Analyze  │──────────▶│ analyzeProject()   │────────▶│ Create Run      │
│ Button   │           │ server/actions/    │         │ status: QUEUED  │
└──────────┘           │ analysis.ts:22-130 │         │ phase: INIT     │
                       └─────────┬──────────┘         └─────────────────┘
                                 │
                    await triggerProcessNextUploadAsync()
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │ process-next-upload │
                       │ /api/runs/[id]/     │
                       │ route.ts            │
                       └─────────┬───────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                      ▼
    ┌─────────────────┐                   ┌─────────────────┐
    │ Find PENDING    │                   │ No pending?     │
    │ RunUpload       │                   │ finalizeRun()   │
    └────────┬────────┘                   └─────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────────────────┐
    │  UPLOAD PROCESSING LOOP (one upload per invocation)     │
    ├─────────────────────────────────────────────────────────┤
    │  1. Update heartbeat (:81-84)                           │
    │  2. Set Run.currentItemId/Index (:136-143)              │
    │  3. RunUpload → LOADING (:149-155)                      │
    │  4. RunUpload → ANALYZING (:187-190)                    │
    │  5. Call AI analyzer (:196-200)                         │
    │  6. RunUpload → SAVING (:207-210)                       │
    │  7. Create cards (:220-238)                             │
    │  8. Upload → COMPLETED (:244-253)                       │
    │  9. RunUpload → COMPLETED (:256-265)                    │
    │  10. Increment Run.completedItems (:268-274)            │
    └────────────────────┬────────────────────────────────────┘
                         │
              triggerProcessNextUpload() (fire-and-forget)
                         │
                         ▼
              ┌─────────────────────────────────────────────┐
              │         NEXT INVOCATION (repeat)            │
              └─────────────────────────────────────────────┘


  FRONTEND POLLING                    API ENDPOINT
       │                                  │
       ▼                                  ▼
┌──────────────────┐           ┌────────────────────────┐
│ useRunProgress() │──poll────▶│ GET /api/runs/[id]     │
│ hooks/use-run-   │  1000ms   │ route.ts               │
│ progress.ts      │           │                        │
│                  │◀──────────│ → getRunProgress()     │
│ pollInterval=1s  │           │   server/actions/      │
│                  │           │   analysis.ts:136-187  │
└──────────────────┘           └────────────────────────┘
```

### Status Transitions

| Location | From Status | To Status | Field Updated |
|----------|-------------|-----------|---------------|
| analysis.ts:78-91 | (new) | QUEUED | Run.status |
| process-next-upload:109-117 | QUEUED | RUNNING | Run.status, Run.startedAt |
| process-next-upload:149-155 | PENDING | LOADING | RunUpload.status |
| process-next-upload:187-190 | LOADING | ANALYZING | RunUpload.status |
| process-next-upload:207-210 | ANALYZING | SAVING | RunUpload.status |
| process-next-upload:256-265 | SAVING | COMPLETED | RunUpload.status |
| process-next-upload:351-425 | RUNNING | SUCCEEDED/FAILED/PARTIAL | Run.status (finalize) |

### Heartbeat Update Points

| File:Line | Trigger | Notes |
|-----------|---------|-------|
| process-next-upload/route.ts:81-84 | Start of each upload | Before finding next pending |
| (MISSING) | During AI call | Long AI calls (30-60s) could trigger stale detection |
| (MISSING) | During card save loop | Could be slow for many cards |

### Progress Data Returned

`getRunProgress()` at `server/actions/analysis.ts:136-187` returns:

```typescript
{
  runId, status, phase, phaseDetail,  // ✓ Available
  totalUploads, completedUploads, failedUploads,  // ✓ Available
  totalCards,  // ✓ Available
  uploads: [...],  // ✓ Per-upload status with cardsCreated
  startedAt, elapsedMs, estimatedRemainingMs,  // ✓ Available
  error  // ✓ Available
}
```

**Current item tracking:** YES - via `Run.currentItemId`, `Run.currentItemIndex`, `Run.phaseDetail`

### Instrumentation Gaps - Card Analysis

| Gap ID | Location | Current | Missing | Priority |
|--------|----------|---------|---------|----------|
| CA-01 | process-next-upload/route.ts | console.log statements | RunLogger not used | HIGH |
| CA-02 | process-next-upload/route.ts:196 | No logging | AI call duration not tracked | MEDIUM |
| CA-03 | process-next-upload/route.ts:220-238 | No logging | Card save progress not tracked | LOW |
| CA-04 | GET /api/runs/[id]/route.ts | Has cache headers | ✓ Correct (no gap) | - |

---

## 2. Epic/Story Generation Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     EPIC/STORY GENERATION PROGRESS FLOW                          │
└─────────────────────────────────────────────────────────────────────────────────┘

  User Click                 Server Action                   Database
      │                          │                              │
      ▼                          ▼                              ▼
┌──────────┐           ┌────────────────────┐         ┌─────────────────┐
│ Generate │──────────▶│startGenerateAll    │────────▶│ Create Run      │
│ Stories  │           │ Stories()          │         │ status: QUEUED  │
│ Button   │           │ server/actions/    │         │ Create RunEpics │
└──────────┘           │ batch-stories.ts   │         │ status: PENDING │
                       │ :21-146            │         └─────────────────┘
                       └─────────┬──────────┘
                                 │
                    await triggerProcessNextAsync()
                                 │
                                 ▼
                       ┌─────────────────────┐
                       │ process-next        │
                       │ /api/runs/[id]/     │
                       │ route.ts            │
                       │ maxDuration: 300s   │
                       └─────────┬───────────┘
                                 │
    ┌────────────────────────────┴────────────────────────────┐
    │          MAIN PROCESSING LOOP (ALL epics in loop)       │
    │          (while: true until no pending or timeout)      │
    ├─────────────────────────────────────────────────────────┤
    │  FOR EACH PENDING EPIC:                                 │
    │    1. Check timeout (280s safety) (:107-112)            │
    │    2. Update heartbeat (:115-118)                       │
    │    3. Check cancellation (:121-128)                     │
    │    4. Find next PENDING RunEpic (:131-144)              │
    │    5. Update Run.phaseDetail (:162-169)                 │
    │    6. Check skip conditions (:177-191)                  │
    │    7. RunEpic → GENERATING (:194-199)                   │
    │    8. Update heartbeat before AI (:225-228)             │
    │    9. Call AI provider (:231)           ◀── LONG WAIT   │
    │   10. Update heartbeat after AI (:234-237)              │
    │   11. RunEpic → SAVING (:244-247)                       │
    │   12. Delete existing stories if replace (:251-255)     │
    │   13. Create stories (:258-275)                         │
    │   14. RunEpic → COMPLETED (:281-291)                    │
    │   15. Apply pacing delay (:328-330)                     │
    └─────────────────────────────────────────────────────────┘
                                 │
                   (loop continues until no pending)
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ finalizeRun()   │
                       │ :390-463        │
                       └─────────────────┘


  FRONTEND POLLING                    API ENDPOINT
       │                                  │
       ▼                                  ▼
┌────────────────────┐        ┌────────────────────────────┐
│useBatchStory       │──poll──▶│ GET /api/runs/[id]/       │
│Progress()          │ 1000ms │ batch-story/route.ts      │
│hooks/use-batch-    │        │                           │
│story-progress.ts   │◀───────│ → getBatchStoryProgress() │
│                    │        │   server/actions/         │
│ pollInterval=1s    │        │   batch-stories.ts:152-217│
└────────────────────┘        └────────────────────────────┘
                                        │
                              ┌─────────┴─────────┐
                              │  NO CACHE HEADERS │ ◀── GAP!
                              └───────────────────┘
```

### Status Transitions

| Location | From Status | To Status | Field Updated |
|----------|-------------|-----------|---------------|
| batch-stories.ts:79-94 | (new) | QUEUED | Run.status |
| process-next/route.ts:78-88 | QUEUED | RUNNING | Run.status, Run.startedAt, Run.heartbeatAt |
| process-next/route.ts:179-186 | PENDING | SKIPPED | RunEpic.status (if skip) |
| process-next/route.ts:194-199 | PENDING | GENERATING | RunEpic.status |
| process-next/route.ts:244-247 | GENERATING | SAVING | RunEpic.status |
| process-next/route.ts:281-291 | SAVING | COMPLETED | RunEpic.status |
| process-next/route.ts:390-463 | RUNNING | SUCCEEDED/FAILED/PARTIAL | Run.status (finalize) |

### Heartbeat Update Points

| File:Line | Trigger | Notes |
|-----------|---------|-------|
| process-next/route.ts:115-118 | Start of each loop iteration | Good - updates frequently |
| process-next/route.ts:225-228 | Before AI call | Good - prevents stale during AI wait |
| process-next/route.ts:234-237 | After AI call | Good - updates after long operation |

### Progress Data Returned

`getBatchStoryProgress()` at `server/actions/batch-stories.ts:152-217` returns:

```typescript
{
  runId, status, phase, phaseDetail,  // ✓ Available
  totalEpics, completedEpics, failedEpics, skippedEpics,  // ✓ Available
  totalStoriesCreated,  // ✓ Available
  currentEpicIndex, currentEpicId, currentEpicTitle,  // ✓ Available
  epics: [...],  // ✓ Per-epic status with storiesCreated
  startedAt, elapsedMs, estimatedRemainingMs,  // ✓ Available
  error  // ✓ Available
}
```

**Current item tracking:** YES - via `Run.currentItemId`, `Run.currentItemIndex`, `Run.phaseDetail`

### Instrumentation Gaps - Epic Generation

| Gap ID | Location | Current | Missing | Priority |
|--------|----------|---------|---------|----------|
| EG-01 | process-next/route.ts | console.log statements | RunLogger not used | HIGH |
| EG-02 | batch-story/route.ts | No cache headers | Cache-Control header missing | HIGH |
| EG-03 | process-next/route.ts:231 | No timing | AI call duration not logged | MEDIUM |
| EG-04 | process-next/route.ts | No structured logs | Can't correlate across invocations | MEDIUM |

---

## 3. Root Cause Hypotheses

### Symptom 1: Card Analysis Frozen Progress

**Observed:** Works but progress panel frozen → completes suddenly

**Hypothesis:** Progress IS being updated correctly in the database. The issue is likely:
1. **Frontend rendering issue** - The progress panel component may not be re-rendering when data changes
2. **Optimistic UI not syncing** - Initial state cached and not refreshed
3. **Polling not starting** - `useRunProgress` may not be receiving the runId to start polling

**Evidence:**
- `getRunProgress()` returns all necessary fields including `phaseDetail` and `currentItemIndex`
- `useRunProgress` hook has clean polling logic with 1s interval
- Cache headers are correctly set on `/api/runs/[id]` endpoint (no-store, no-cache)

**Investigation needed:** Check the component that displays progress - is it receiving the runId? Is polling actually happening?

### Symptom 2: Epic Generation No Progress Indicator

**Observed:** No progress panel, just spinning button → eventually works

**Hypothesis:** The batch-story progress endpoint is missing cache headers, causing:
1. **Stale cached responses** - Browser or CDN caching old progress data
2. **Frontend not receiving updates** - Polling happens but gets cached "QUEUED" response

**Evidence:**
- `GET /api/runs/[id]/batch-story/route.ts` has **NO cache headers** (lines 9-33)
- Compare to `GET /api/runs/[id]/route.ts` which has proper headers (lines 26-31)

**Root cause identified:** Missing `Cache-Control: no-store, no-cache, must-revalidate` headers

### Symptom 3: Story Generation Timeout / Modal Resets

**Observed:** Spinning button → modal resets, no stories created

**Hypothesis:** This is the E7 failure mentioned in PROJECT.md. Possible causes:
1. **Initial trigger failure** - `triggerProcessNextAsync()` fails but run is marked QUEUED
2. **Stale detection too aggressive** - 2-minute threshold may be hit during long AI calls
3. **Vercel Deployment Protection blocking** - Internal API calls rejected by Vercel auth

**Evidence from code:**
- `batch-stories.ts:114-134` already handles trigger failure by marking run as FAILED
- `process-next/route.ts:225-237` updates heartbeat before AND after AI call (good)
- `process-next-trigger.ts:59-62` has bypass header logic for Vercel protection

**Investigation needed:** Check production logs for trigger failures or 401 responses

---

## 4. Specific Fixes Needed (Plan 02 Scope)

### Priority 1: Add Cache Headers to Batch Story Endpoint

**File:** `app/api/runs/[id]/batch-story/route.ts`

**Change:** Add cache control headers matching the card analysis endpoint:

```typescript
return NextResponse.json(progress, {
  headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  },
});
```

### Priority 2: Replace Console.log with RunLogger

**Files to update:**
1. `app/api/runs/[id]/process-next/route.ts` - 10+ console.log statements
2. `app/api/runs/[id]/process-next-upload/route.ts` - 8+ console.log statements
3. `lib/run-engine/process-next-trigger.ts` - 10+ console.log statements

**Pattern:**
```typescript
// Before (current)
console.log(`[ProcessNext ${runId}] Starting batch processing...`);

// After (with RunLogger)
const logger = createRunLogger(runId, request);
logger.invocationStarted(remainingEpics);
```

### Priority 3: Add AI Call Duration Tracking

**Files:**
1. `app/api/runs/[id]/process-next/route.ts:231`
2. `app/api/runs/[id]/process-next-upload/route.ts:196`

**Pattern:**
```typescript
const aiStartTime = Date.now();
logger.claudeRequest(model, tokenEstimate);

const result = await provider.generateStories(...);

const aiDuration = Date.now() - aiStartTime;
logger.claudeResponse(result.requestId, result.tokensUsed, aiDuration);
```

### Priority 4: Update Stale Heartbeat Documentation

**File:** `lib/observability/heartbeat.ts`

The file comments claim `heartbeatAt` doesn't exist, but it does and is being used correctly in both processing endpoints. Update comments to reflect reality.

---

## 5. Files Analyzed

| File | Purpose | Lines | Key Findings |
|------|---------|-------|--------------|
| `server/actions/analysis.ts` | Card analysis entry point | 353 | Creates run, triggers processing |
| `server/actions/batch-stories.ts` | Epic generation entry point | 393 | Creates run, triggers processing, handles failure |
| `app/api/runs/[id]/route.ts` | Card analysis polling | 41 | ✓ Has cache headers |
| `app/api/runs/[id]/batch-story/route.ts` | Epic polling | 34 | ✗ MISSING cache headers |
| `app/api/runs/[id]/process-next/route.ts` | Epic processing | 502 | Loop-based, good heartbeats, uses console.log |
| `app/api/runs/[id]/process-next-upload/route.ts` | Card processing | 438 | Continuation-based, uses console.log |
| `hooks/use-run-progress.ts` | Card progress hook | 280 | 1s polling, terminal detection |
| `hooks/use-batch-story-progress.ts` | Epic progress hook | 295 | 1s polling, terminal detection |
| `lib/run-engine/process-next-trigger.ts` | Internal API triggers | 239 | Handles Vercel bypass headers |
| `lib/observability/logger.ts` | Structured logging | 404 | Comprehensive but NOT USED |
| `lib/observability/heartbeat.ts` | Stale detection | 396 | Stale comments (heartbeatAt exists) |

---

## 6. Summary

**What's Working:**
- Both flows have proper status transitions
- Heartbeat updates happen at the right times (especially epic generation)
- Progress data includes all needed fields including current item tracking
- Card analysis endpoint has correct cache headers
- Terminal state detection works in both frontend hooks

**What's Broken/Missing:**
1. **Batch story endpoint missing cache headers** - HIGH priority, likely causing "no progress" symptom
2. **RunLogger never used** - HIGH priority, limits production debugging
3. **AI call duration not tracked** - MEDIUM priority, needed for performance analysis
4. **Stale heartbeat.ts comments** - LOW priority, documentation debt

**Next Step:** Plan 02 should add instrumentation starting with the cache header fix (quick win) then RunLogger integration (larger change).
