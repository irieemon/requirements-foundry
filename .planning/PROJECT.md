# Requirements Foundry - Generative Pipeline Fix

## What This Is

Requirements Foundry is a tool that transforms uploaded documents into structured requirements (cards), groups them into epics, generates user stories with AI, and breaks stories down into implementable subtasks. Work items can be mapped to MSS (Master Service Schedule) taxonomy for service line visibility. The generative pipeline works reliably with real-time progress feedback, and the UI provides a polished dashboard with contextual navigation, MSS management, and preview-first JIRA export.

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
- Contextual sidebar navigation with project sections — v1.1
- Breadcrumb navigation for hierarchical location — v1.1
- Large file uploads (>4.5MB) via client-side Blob — v1.1
- Modern card redesign for epics/stories/subtasks — v1.1
- JIRA export preview showing exact import hierarchy — v1.1
- Tabbed export wizard with validation indicators — v1.1
- MSS taxonomy import (L2/L3/L4 service hierarchy) — v1.2
- MSS management UI (CRUD for service entries) — v1.2
- MSS mapping to epics/stories with AI auto-assignment — v1.2
- MSS dashboard with coverage metrics — v1.2
- MSS export integration with JIRA — v1.2

### Active

(No active requirements - ready for next milestone planning)

### Out of Scope

- New features beyond restoring working state — focus was on fixing regressions (COMPLETE)
- UI redesign of progress panels — kept existing UI, made it update correctly (COMPLETE)
- Authentication/authorization — not part of current scope

## Context

**Shipped v1.2 with:**
- ~34,435 lines of TypeScript/TSX
- Tech stack: Next.js, Prisma, Claude AI, Vercel, @vercel/blob
- 17 phases, 35 plans executed over 15 days
- All generative flows working with real-time progress
- Complete MSS taxonomy management (import, CRUD, mapping, dashboard, export)
- AI auto-assignment of MSS during epic generation
- Preview-first JIRA export with MSS integration

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
| Preview tab default in export wizard | Data-first UX ensures users see what they export | Good |
| Client-side Blob uploads | Bypasses 4.5MB serverless body limit | Good |
| Container/Presentational card pattern | Better separation of concerns, testability | Good |
| Tabbed interface for wizard steps | Reduces cognitive load, clear section separation | Good |
| Upsert pattern for MSS CSV import | Same file can be re-imported safely | Good |
| Polymorphic MSS dialogs | Single component handles L2/L3/L4 levels | Good |
| MSS inheritance (story from epic) | Reduces manual mapping, consistent in export | Good |
| Arrow format for MSS in exports | "Service Line → Service Area" clear hierarchy | Good |

---
*Last updated: 2026-01-27 after v1.2 milestone*
