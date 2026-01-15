# Requirements Foundry - Generative Pipeline Fix

## What This Is

Requirements Foundry is a tool that transforms uploaded documents into structured requirements (cards), groups them into epics, generates user stories with AI, and breaks stories down into implementable subtasks. The generative pipeline now works reliably with real-time progress feedback across all flows.

## Core Value

**All generative flows complete successfully with real-time progress feedback.** Users always know what's happening behind the scenes—no more "hanging" UI.

## Requirements

### Validated

- Document upload and extraction pipeline — existing
- Card analysis from uploaded documents — existing
- Epic generation from analyzed cards — existing
- Story generation wizard with configuration — existing
- Continuation pattern for Vercel 300s timeout — existing
- Polling-based progress tracking architecture — existing
- Stale run detection and recovery — existing
- JIRA export pipeline — existing
- Story generation completes without timeout — v1.0 (self-continuation + fire-and-confirm)
- Progress panels update in real-time during card analysis — v1.0 (elapsed time + animated indicators)
- Epic generation shows progress indicator — v1.0 (elapsed time tracking)
- All generative flows provide visual feedback — v1.0 (consistent UX)
- Stories page with epic grouping — v1.0
- Subtask generation from user stories — v1.0
- Subtasks viewing page — v1.0
- Performance optimization (batch operations, parallel processing) — v1.0

### Active

(None — v1.0 milestone complete, awaiting next feature requests)

### Out of Scope

- New features beyond restoring working state — focus was on fixing regressions (COMPLETE)
- UI redesign of progress panels — kept existing UI, made it update correctly (COMPLETE)
- Authentication/authorization — not part of current scope

## Context

**Shipped v1.0 with:**
- ~26,800 lines of TypeScript/TSX
- Tech stack: Next.js, Prisma, Claude AI, Vercel
- 9 phases, 17 plans executed over 3 days
- All three generative flows working with real-time progress
- Subtask generation pipeline fully operational
- Performance optimized with batch operations and limited parallelization

## Constraints

- **Vercel Pro limits**: 300s function timeout, works within this via continuation pattern
- **Backward compatibility**: Existing runs/data continue to work
- **Remote testing only**: User tests on Vercel production, not locally

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over WebSockets | Simpler for serverless, already implemented | Good |
| Continuation pattern for timeouts | Vercel-compatible, proven approach | Good |
| Heartbeat-based stale detection | Catches stuck runs automatically | Good (resolved E7 issue) |
| Loop-based epic processing | Single invocation processes all epics | Good |
| Fire-and-confirm trigger pattern | 10s abort timeout prevents server action hangs | Good |
| Frontend-only progress enhancement | No new API calls, uses existing polling data | Good |
| Batch DB operations first | Zero-risk foundation before parallelization | Good |
| Limited parallelization (2-3 concurrent) | Respects Claude API rate limits | Good |

---
*Last updated: 2026-01-15 after v1.0 milestone*
