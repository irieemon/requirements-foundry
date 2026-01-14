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
- [ ] **Phase 5: Integration Verification** - End-to-end testing of all three flows

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
- [ ] Card analysis: Progress updates visible, completes successfully
- [ ] Epic generation: Progress indicator visible, completes successfully
- [ ] Story generation: Progress visible, no timeouts, stories created

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Investigation & Instrumentation | 2/2 | Complete | 2026-01-13 |
| 2. Card Analysis Progress Fix | 1/1 | Complete | 2026-01-13 |
| 3. Epic Generation Progress Fix | 1/1 | Complete | 2026-01-13 |
| 4. Story Generation Timeout Fix | 1/1 | Complete | 2026-01-14 |
| 5. Integration Verification | 0/TBD | Not started | - |
