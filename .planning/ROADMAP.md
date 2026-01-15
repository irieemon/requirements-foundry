# Roadmap: Requirements Foundry - Generative Pipeline Fix

## Milestones

- ✅ [v1.0 Generative Pipeline Fix](milestones/v1.0-ROADMAP.md) (Phases 1-9) — SHIPPED 2026-01-15
- 🚧 **v1.1 UX Polish** — Phases 10-12 (in progress)

## Overview

This roadmap addressed three regressed generative flows: card analysis (frozen progress), epic generation (no progress indicator), and story generation (silent timeout failures). All flows now work with real-time progress feedback, plus subtask generation and performance optimizations.

## Domain Expertise

None

## Completed Milestones

<details>
<summary> v1.0 Generative Pipeline Fix (Phases 1-9) — SHIPPED 2026-01-15</summary>

- [x] **Phase 1: Investigation & Instrumentation** (2/2 plans) — completed 2026-01-13
- [x] **Phase 2: Card Analysis Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 3: Epic Generation Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 4: Story Generation Timeout Fix** (1/1 plan) — completed 2026-01-14
- [x] **Phase 5: Integration Verification** (2/2 plans) — completed 2026-01-15
- [x] **Phase 6: Stories Page** (1/1 plan) — completed 2026-01-14
- [x] **Phase 7: Subtask Generation** (5/5 plans) — completed 2026-01-14
- [x] **Phase 8: Subtask Viewing** (1/1 plan) — completed 2026-01-15
- [x] **Phase 9: Performance Optimization** (3/3 plans) — completed 2026-01-15

**Key accomplishments:**
- Fixed real-time progress for card analysis, epic generation, story generation
- Added Stories page and Subtasks page
- Implemented full subtask generation pipeline
- Optimized with batch DB operations and parallel processing

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full details.

</details>

### 🚧 v1.1 UX Polish (In Progress)

**Milestone Goal:** Transform working but clunky interface into polished, modern dashboard that makes relationships clear

#### Phase 10: Navigation & Layout

**Goal**: Overhaul sidebar, page structure, and flow between sections
**Depends on**: v1.0 complete
**Research**: No (internal UX patterns, existing shadcn/ui)
**Plans**: 3

Plans:
- [ ] 10-01: Enhanced Sidebar Navigation - contextual project sections
- [ ] 10-02: Breadcrumb Navigation - hierarchical location trail
- [ ] 10-03: Mobile Nav & Layout Polish - mobile parity and spacing consistency

#### Phase 11: Data Display & Hierarchy

**Goal**: Visualize cards, epics, stories, subtasks - making relationships clear and intuitive
**Depends on**: Phase 10
**Research**: Unlikely (existing components, no external APIs)
**Plans**: TBD

Plans:
- [ ] 11-01: TBD (run /gsd:plan-phase 11 to break down)

#### Phase 12: JIRA Export Preview

**Goal**: Show users exactly what will be imported into JIRA before export, final polish
**Depends on**: Phase 11
**Research**: Unlikely (existing JIRA mapping logic)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD (run /gsd:plan-phase 12 to break down)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Investigation & Instrumentation | v1.0 | 2/2 | Complete | 2026-01-13 |
| 2. Card Analysis Progress Fix | v1.0 | 1/1 | Complete | 2026-01-13 |
| 3. Epic Generation Progress Fix | v1.0 | 1/1 | Complete | 2026-01-13 |
| 4. Story Generation Timeout Fix | v1.0 | 1/1 | Complete | 2026-01-14 |
| 5. Integration Verification | v1.0 | 2/2 | Complete | 2026-01-15 |
| 6. Stories Page | v1.0 | 1/1 | Complete | 2026-01-14 |
| 7. Subtask Generation | v1.0 | 5/5 | Complete | 2026-01-14 |
| 8. Subtask Viewing | v1.0 | 1/1 | Complete | 2026-01-15 |
| 9. Performance Optimization | v1.0 | 3/3 | Complete | 2026-01-15 |
| 10. Navigation & Layout | v1.1 | 0/3 | Planned | - |
| 11. Data Display & Hierarchy | v1.1 | 0/? | Not started | - |
| 12. JIRA Export Preview | v1.1 | 0/? | Not started | - |
