# Roadmap: Requirements Foundry - Generative Pipeline Fix

## Milestones

- ✅ [v1.0 Generative Pipeline Fix](milestones/v1.0-ROADMAP.md) (Phases 1-9) — SHIPPED 2026-01-15
- ✅ [v1.1 UX Polish](milestones/v1.1-ROADMAP.md) (Phases 10-12) — SHIPPED 2026-01-20
- 🚧 **v1.2 MSS Integration** — Phases 13-17 (in progress)

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

<details>
<summary>✅ v1.1 UX Polish (Phases 10-12) — SHIPPED 2026-01-20</summary>

- [x] Phase 10: Navigation & Layout (3/3 plans) — completed 2026-01-15
- [x] Phase 10.1: Upload Client Direct (1/1 plan) — completed 2026-01-16
- [x] Phase 10.2: KPI & Subtask UX (1/1 plan) — completed 2026-01-16
- [x] Phase 11: Data Display & Hierarchy (3/3 plans) — completed 2026-01-20
- [x] Phase 12: JIRA Export Preview (2/2 plans) — completed 2026-01-20

**Key accomplishments:**
- Contextual sidebar navigation with project sections
- Fixed 413 file upload errors (client-side Blob uploads)
- Modern card redesign for epics/stories/subtasks
- Tabbed JIRA export wizard with preview-first UX

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full details.

</details>

### 🚧 v1.2 MSS Integration (In Progress)

**Milestone Goal:** Import and manage Master Service Schedule (MSS) taxonomy, map work items to service lines for effort visibility

**Status:** Not started - ready for `/gsd:plan-phase 13`

#### Phase 13: MSS Data Model & Import

**Goal**: Create database schema for L2/L3/L4 service hierarchy, CSV import functionality
**Depends on**: v1.1 complete
**Research**: Unlikely (internal DB patterns, CSV parsing)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD (run /gsd:plan-phase 13 to break down)

#### Phase 14: MSS Management UI

**Goal**: CRUD interface to view, add, edit, delete MSS entries
**Depends on**: Phase 13
**Research**: Unlikely (existing CRUD patterns)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD (run /gsd:plan-phase 14 to break down)

#### Phase 15: MSS Mapping to Work Items

**Goal**: Add MSS selector to epics/stories, store relationships
**Depends on**: Phase 14
**Research**: No (existing patterns)
**Plans**: 2

Plans:
- [ ] 15-01: Schema & AI Integration (mssServiceAreaId FK, AI auto-assignment)
- [ ] 15-02: UI Integration (MSS selector, epic/story card display)

#### Phase 16: MSS Dashboard & Reporting

**Goal**: View work items grouped by service line, effort summaries
**Depends on**: Phase 15
**Research**: Unlikely (internal aggregation)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD (run /gsd:plan-phase 16 to break down)

#### Phase 17: MSS Export Integration

**Goal**: Include MSS mappings in JIRA export
**Depends on**: Phase 16
**Research**: Unlikely (extending existing JIRA export)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD (run /gsd:plan-phase 17 to break down)

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
| 10. Navigation & Layout | v1.1 | 3/3 | Complete | 2026-01-15 |
| 10.1 Upload Client Direct | v1.1 | 1/1 | Complete | 2026-01-16 |
| 10.2 KPI & Subtask UX | v1.1 | 1/1 | Complete | 2026-01-16 |
| 11. Data Display & Hierarchy | v1.1 | 3/3 | Complete | 2026-01-20 |
| 12. JIRA Export Preview | v1.1 | 2/2 | Complete | 2026-01-20 |
| 13. MSS Data Model & Import | v1.2 | 0/? | Not started | - |
| 14. MSS Management UI | v1.2 | 0/? | Not started | - |
| 15. MSS Mapping to Work Items | v1.2 | 0/? | Not started | - |
| 16. MSS Dashboard & Reporting | v1.2 | 0/? | Not started | - |
| 17. MSS Export Integration | v1.2 | 0/? | Not started | - |
