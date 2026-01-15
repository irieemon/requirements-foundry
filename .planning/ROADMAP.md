# Roadmap: Requirements Foundry - Generative Pipeline Fix

## Overview

This roadmap addresses three regressed generative flows: card analysis (frozen progress), epic generation (no progress indicator), and story generation (silent timeout failures). We start with investigation to understand root causes, then fix each flow systematically, and finish with integration verification.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Investigation & Instrumentation** - Add observability to understand failure points
- [x] **Phase 2: Card Analysis Progress Fix** - Fix frozen progress panel during card analysis
- [x] **Phase 3: Epic Generation Progress Fix** - Add progress indicator for epic generation
- [x] **Phase 4: Story Generation Timeout Fix** - Fix silent failures and modal resets
- [x] **Phase 5: Integration Verification** - End-to-end testing of all three flows
- [x] **Phase 6: Stories Page** - Add stories section to view all generated stories
- [x] **Phase 7: Subtask Generation** - Generate subtasks from stories (following epic/story pattern)
- [x] **Phase 8: Subtask Viewing** - Add subtasks section to view generated subtasks (similar to stories page)
- [x] **Phase 9: Performance Optimization** - Optimize generative pipeline for faster execution through batch operations and limited parallelization

## Phase Details

### Phase 1: Investigation & Instrumentation
**Goal**: Understand what's breaking in each generative flow by adding logging and tracing
**Depends on**: Nothing (first phase)
**Research**: Unlikely (codebase exploration, established patterns)
**Plans**: TBD

Key areas to investigate:
- Polling lifecycle in `useBatchStoryProgress` and similar hooks
- Server action → API route → continuation flow
- Run status updates during processing
- Frontend state management during polling

### Phase 2: Card Analysis Progress Fix
**Goal**: Progress panel updates in real-time during card analysis
**Depends on**: Phase 1
**Research**: Unlikely (internal polling patterns exist)
**Plans**: TBD

Symptom: Works but progress panel frozen → completes suddenly

### Phase 3: Epic Generation Progress Fix
**Goal**: Epic generation shows progress indicator instead of just spinning button
**Depends on**: Phase 2
**Research**: Unlikely (same pattern as Phase 2)
**Plans**: TBD

Symptom: No progress panel, just spinning button → eventually works

### Phase 4: Story Generation Timeout Fix
**Goal**: Story generation completes without timeout or silent failures
**Depends on**: Phase 3
**Research**: Likely (continuation pattern debugging)
**Research topics**: Vercel function timeout behavior, heartbeat vs continuation pattern interaction, stale run detection edge cases
**Plans**: TBD

Symptom: Spinning button → modal resets, no stories created
Note: Heartbeat-based stale detection may have caused E7 failure (see PROJECT.md)

### Phase 5: Integration Verification
**Goal**: All three generative flows work end-to-end with proper progress feedback
**Depends on**: Phase 4
**Research**: Unlikely (testing existing functionality)
**Plans**: TBD

Verification checklist:
- [x] Card analysis: Progress updates visible, completes successfully (05-01)
- [x] Epic generation: Progress indicator visible, completes successfully (05-01)
- [x] Story generation: Progress visible, no timeouts, stories created (05-02)
- [x] Stories page: Displays generated stories grouped by epic (05-02)
- [x] Subtask generation: Progress visible, subtasks created (05-02)

Note: Subtask viewing UX to be addressed in future phase (generation works, but no dedicated view)

### Phase 6: Stories Page
**Goal**: Add a dedicated stories section to view all generated stories (similar to uploads, cards, epics pages)
**Depends on**: Phase 5
**Research**: Unlikely (follows existing page patterns)
**Plans**: 1/1 Complete

Features:
- [x] Stories section on project detail page (grouped by epic)
- [x] KPI card showing total story count
- [x] Reuses existing StoryTable component with expandable rows

### Phase 7: Subtask Generation
**Goal**: Generate subtasks from user stories, following the same Run + Junction + Executor + Polling pattern used for epic and story generation
**Depends on**: Phase 6
**Research**: Unlikely (replicates established patterns)
**Plans**: TBD

Components needed:
- [x] Subtask model in Prisma schema (07-01)
- [x] RunStory junction model (tracks per-story progress) (07-01)
- [x] Server actions (startGenerateSubtasks, getSubtaskProgress) (07-02)
- [x] Subtask executor (lib/run-engine/subtask-executor.ts) (07-02)
- [x] AI prompt for subtask generation (07-02)
- [x] SubtaskConfigDialog component (07-04)
- [x] SubtaskRunProgress component (07-04)
- [x] Epic page integration (07-05)
- [x] Subtask display in story detail/expansion (moved to Phase 8)

### Phase 8: Subtask Viewing
**Goal**: Add a dedicated subtasks section to view all generated subtasks (similar to stories page pattern)
**Depends on**: Phase 7
**Research**: Unlikely (follows Phase 6 patterns exactly)
**Plans**: TBD

Features:
- [x] Subtasks section on project detail page (grouped by story within epic)
- [x] KPI card showing total subtask count
- [x] SubtaskTable component with expandable rows

### Phase 9: Performance Optimization
**Goal**: Optimize the generative pipeline for faster execution while maintaining stability
**Depends on**: Phase 8
**Research**: Completed (deep analysis via specialized agents)
**Plans**: 3 (escalating risk/reward)

Optimization tiers:
- [x] Plan 09-01: Quick wins - Batch `createMany()` operations (zero risk, ~1.5-2x on DB ops)
- [x] Plan 09-02: Safety infrastructure - Version fields, atomic logging (low risk, foundation for parallelization)
- [x] Plan 09-03: Limited parallelization - 2-3 concurrent uploads with rate limiting (medium risk, ~2x speedup)

Key constraints:
- Claude API rate limits (max 2-3 concurrent requests recommended)
- Database concurrency safety (version fields + atomic operations)
- Maintain existing functionality (no breaking changes)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Investigation & Instrumentation | 2/2 | Complete | 2026-01-13 |
| 2. Card Analysis Progress Fix | 1/1 | Complete | 2026-01-13 |
| 3. Epic Generation Progress Fix | 1/1 | Complete | 2026-01-13 |
| 4. Story Generation Timeout Fix | 1/1 | Complete | 2026-01-14 |
| 5. Integration Verification | 2/2 | Complete | 2026-01-15 |
| 6. Stories Page | 1/1 | Complete | 2026-01-14 |
| 7. Subtask Generation | 5/5 | Complete | 2026-01-14 |
| 8. Subtask Viewing | 1/1 | Complete | 2026-01-15 |
| 9. Performance Optimization | 3/3 | Complete | 2026-01-15 |
