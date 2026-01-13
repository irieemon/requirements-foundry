# Requirements Foundry - Generative Pipeline Fix

## What This Is

Requirements Foundry is a tool that transforms uploaded documents into structured requirements (cards), groups them into epics, and generates user stories with AI. The generative pipeline has regressed—progress visualization doesn't update in real-time, and story generation times out on Vercel.

## Core Value

**All three generative flows must complete successfully with real-time progress feedback.** Users should never see a "hanging" UI—they should always know what's happening behind the scenes.

## Requirements

### Validated

- ✓ Document upload and extraction pipeline — existing
- ✓ Card analysis from uploaded documents — existing
- ✓ Epic generation from analyzed cards — existing
- ✓ Story generation wizard with configuration — existing
- ✓ Continuation pattern for Vercel 300s timeout — existing
- ✓ Polling-based progress tracking architecture — existing
- ✓ Stale run detection and recovery — existing
- ✓ JIRA export pipeline — existing

### Active

- [ ] **Story generation completes without timeout** — currently resets/fails silently
- [ ] **Progress panels update in real-time during card analysis** — currently appears frozen
- [ ] **Epic generation shows progress indicator** — currently only spinning button
- [ ] **All generative flows provide visual feedback** — consistent UX across all operations

### Out of Scope

- New features beyond restoring working state — focus is on fixing regressions
- Performance optimization — just make it work first
- UI redesign of progress panels — keep existing UI, make it update correctly
- Authentication/authorization — not part of current scope

## Context

**Recent work that may have caused regressions:**
- Vercel Deployment Protection bypass fix (x-vercel-protection-bypass header)
- Heartbeat updates during AI generation (just deployed)
- Loop-based processing for batch story generation

**Architecture (from .planning/codebase/):**
- Server Actions trigger runs via `triggerProcessNextAsync()`
- API routes process items with continuation pattern
- Frontend polls `/api/runs/[id]/batch-story` for progress
- Hooks like `useBatchStoryProgress` manage polling lifecycle
- Run status stored in database, updated throughout processing

**Symptom patterns:**
1. Card analysis: Works but progress panel frozen → completes suddenly
2. Epic generation: No progress panel, just spinning button → eventually works
3. Story generation: Spinning button → modal resets, no stories created

## Constraints

- **Vercel Pro limits**: 300s function timeout, must work within this
- **Backward compatibility**: Existing runs/data must continue to work
- **Remote testing only**: User can only test on Vercel production, not locally

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over WebSockets | Simpler for serverless, already implemented | ✓ Good |
| Continuation pattern for timeouts | Vercel-compatible, proven approach | ✓ Good |
| Heartbeat-based stale detection | Catches stuck runs automatically | ⚠️ Revisit - caused E7 failure |
| Loop-based epic processing | Single invocation processes all epics | — Pending |

---
*Last updated: 2025-01-12 after initialization*
