# Performance Optimization Discovery

**Analysis Date:** 2026-01-14
**Phase:** 09-performance-optimization

## Executive Summary

The generative pipeline (card analysis, story generation, subtask generation) currently uses **sequential processing** with individual database writes. Analysis reveals three tiers of optimization opportunities with escalating risk/reward profiles.

## Current Architecture

### Execution Patterns

| Phase | Current Pattern | Bottleneck |
|-------|-----------------|------------|
| Card Analysis | Sequential uploads, one-by-one card creation | DB roundtrips |
| Story Generation | Sequential epics, one-by-one story creation | DB roundtrips + API calls |
| Subtask Generation | Sequential stories, batch subtask creation | API calls |

### Key Observations

1. **Card/Story creation uses individual `create()` loops** - 5-10 DB roundtrips per epic/upload
2. **No database transactions** - All operations are individual atomic statements
3. **Log appending uses read-then-write pattern** - Race condition risk
4. **Continuation pattern already handles Vercel 300s timeout** - Well designed

## Optimization Opportunities

### Tier 1: Zero-Risk Quick Wins (~1.5-2x improvement)

**Batch Database Operations:**
- Convert `db.story.create()` loops to `db.story.createMany()`
- Convert `db.card.create()` loops to `db.card.createMany()`
- ~5-10x fewer DB roundtrips per epic/upload
- **Effort:** 10-20 minutes per change
- **Risk:** None

**Atomic Log Appending:**
- Replace read-then-write pattern with atomic SQL CONCAT
- Or: Create separate RunLog table for append-only logging
- **Effort:** 30 minutes
- **Risk:** None

### Tier 2: Safety Infrastructure (Foundation for parallelization)

**Version Fields for Optimistic Concurrency:**
- Add `version Int @default(1)` to Run, RunEpic, RunStory
- Use compare-and-swap updates for status transitions
- **Effort:** 1-2 hours
- **Risk:** Low (schema migration)

**Transaction Wrappers:**
- Wrap critical operations in `$transaction()` blocks
- Counter updates + status transitions as atomic unit
- **Effort:** 1-2 hours
- **Risk:** Low

### Tier 3: Limited Parallelization (2-3x improvement potential)

**Parallel Card Analysis (2-3 concurrent uploads):**
- Use `pLimit` for concurrency control
- Each upload independent (no data dependencies)
- **Risk:** Medium (API rate limiting)
- **Mitigation:** Monitor Claude API rate limits, backoff on 429

**Parallel Story Generation (2 concurrent epics):**
- Requires epic "claiming" mechanism
- Update to RESERVED status atomically before processing
- **Risk:** High (race conditions, timeout complexity)
- **Mitigation:** Transaction-based claiming, careful timeout math

## API Rate Limiting Constraints

### Anthropic Claude API Limits

| Parameter | Limit | Recommendation |
|-----------|-------|----------------|
| Concurrent Requests | ~10 (soft limit) | Use 2-3 max |
| Tokens/Minute | 40,000 (Pro) | Monitor usage |
| Rate Limit Response | HTTP 429 | Implement backoff |

### Current Pacing Configuration

| Mode | Delay | Max Retries |
|------|-------|-------------|
| safe | 2000ms | 3 |
| normal | 1000ms | 2 |
| fast | 500ms | 2 |

**Recommendation:** Keep sequential processing with pacing for AI calls. Parallelize DB operations only.

## Database Concurrency Risks

### Critical Issues If Parallelizing Without Safeguards

1. **Run status transitions** - Two processes could enter RUNNING simultaneously
2. **Counter increments** - Lost updates possible with concurrent increments
3. **Log appending** - Read-then-write race loses log entries
4. **Story counts** - Stale count leads to wrong skip/replace decisions

### Safe Parallelization Patterns

```typescript
// Pattern 1: Atomic claiming with version
const claimed = await db.runEpic.updateMany({
  where: { id: epicId, status: 'PENDING', version: 1 },
  data: { status: 'GENERATING', version: 2 }
});
if (claimed.count === 0) return; // Already claimed

// Pattern 2: Transaction for counter + status
await db.$transaction(async (tx) => {
  await tx.runEpic.update({ where: { id }, data: { status: 'COMPLETED' }});
  await tx.run.update({ where: { id: runId }, data: { completedItems: { increment: 1 }}});
});

// Pattern 3: Batch creation
await db.story.createMany({ data: stories.map(s => ({ ...s, epicId })) });
```

## Recommended Implementation Approach

### Phase 9 Structure

**Plan 09-01: Quick Wins (Zero Risk)**
- Batch `createMany()` for stories, cards
- Atomic log appending
- Expected: 1.5-2x improvement on DB operations

**Plan 09-02: Safety Infrastructure (Low Risk)**
- Version fields for concurrency control
- Transaction wrappers for critical operations
- Foundation for safe parallelization

**Plan 09-03: Limited Parallelization (Medium Risk)**
- Concurrent card analysis (2-3 uploads)
- API rate limit monitoring
- Checkpoint for verification

## Metrics to Monitor

After implementation:
- End-to-end run duration
- Per-phase duration (card analysis, story gen, subtask gen)
- DB roundtrip count
- API response times
- Error rates (especially 429s)

## Files to Modify

### Tier 1 (Batch Operations)
- `app/api/runs/[id]/process-next/route.ts` - Story creation
- `lib/run-engine/executor.ts` - Card creation
- `lib/run-engine/subtask-executor.ts` - (Already using createMany)
- `lib/run-engine/batch-story-executor.ts` - Story creation

### Tier 2 (Safety Infrastructure)
- `prisma/schema.prisma` - Version fields
- `server/actions/batch-stories.ts` - Transaction wrappers
- `server/actions/subtasks.ts` - Transaction wrappers

### Tier 3 (Parallelization)
- `lib/run-engine/executor.ts` - Parallel upload processing
- `app/api/runs/[id]/process-next/route.ts` - Parallel epic processing

## Conclusion

Start with **zero-risk batch operations** (Plan 09-01) which require minimal changes and have immediate impact. Build **safety infrastructure** (Plan 09-02) before attempting parallelization. Only proceed to **limited parallelization** (Plan 09-03) after verification that previous plans work correctly.

This conservative approach ensures we don't break the working system while achieving meaningful performance improvements.

---
*Discovery analysis: 2026-01-14*
*Based on deep analysis by specialized agents*
