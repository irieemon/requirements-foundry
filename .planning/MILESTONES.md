# Project Milestones: Requirements Foundry

## v1.2 MSS Integration (Shipped: 2026-01-27)

**Delivered:** Complete MSS (Master Service Schedule) taxonomy management pipeline from CSV import through JIRA export, enabling work items to be mapped to service lines for effort visibility.

**Phases completed:** 13-17 (8 plans total)

**Key accomplishments:**

- Created L2/L3/L4 MSS taxonomy schema with flexible CSV import and auto-column detection
- Built full CRUD management UI with collapsible hierarchy viewer and polymorphic dialogs
- Added MSS selector to epics/stories with AI auto-assignment during generation
- Created dashboard with coverage metrics and color-coded service line breakdown
- Integrated MSS into JIRA export with inheritance support (stories inherit from epics)

**Stats:**

- ~17 commits in milestone
- ~3,947 net lines added (30,500 → 34,435 TypeScript/TSX)
- 5 phases, 8 plans
- 7 days from start to ship (Jan 20-27, 2026)

**Git range:** `feat(13-01)` → `feat(17-01)`

**What's next:** TBD - milestone complete, ready for next feature development

---

## v1.1 UX Polish (Shipped: 2026-01-20)

**Delivered:** Transformed working but clunky interface into polished, modern dashboard with contextual navigation, modern card designs, and preview-first JIRA export experience.

**Phases completed:** 10-12 (10 plans total, including decimal phases 10.1 and 10.2)

**Key accomplishments:**

- Contextual sidebar navigation with project sections and visual hierarchy
- Fixed 413 file upload errors with client-side direct Blob uploads (files >4.5MB now work)
- Modern card redesign for epics/stories/subtasks following Notion/Linear aesthetic
- Tabbed JIRA export wizard with preview-first UX showing exact import hierarchy
- Mobile navigation parity and responsive KPI layout

**Stats:**

- 44 files created/modified
- ~3,666 net lines added
- 5 phases (3 planned + 2 decimal), 10 plans
- 5 days from start to ship (Jan 15-20, 2026)

**Git range:** `feat(10-01)` → `feat(12-02)`

**What's next:** v1.2 MSS Integration - Import and manage Master Service Schedule taxonomy

---

## v1.0 Generative Pipeline Fix (Shipped: 2026-01-15)

**Delivered:** Fixed all three regressed generative flows (card analysis, epic generation, story generation) with real-time progress feedback, plus added subtask generation and performance optimizations.

**Phases completed:** 1-9 (17 plans total)

**Key accomplishments:**

- Fixed frozen progress panel during card analysis with live elapsed time tracking and animated indicators
- Added progress indicator for epic generation (was just spinning button)
- Fixed story generation timeouts with self-continuation and fire-and-confirm trigger patterns
- Added Stories page with grouping by epic and KPI tracking
- Implemented full subtask generation pipeline (schema, executor, UI, progress polling)
- Added Subtasks viewing page with hierarchical display (story within epic)
- Optimized performance with batch DB operations (`createMany`) and parallel card analysis (2-3 concurrent)

**Stats:**

- 78 files created/modified
- ~12,000 lines added
- 26,788 total lines of TypeScript/TSX
- 9 phases, 17 plans
- 3 days from start to ship (Jan 12-15, 2026)

**Git range:** `feat(01-02)` → `feat(09-03)`

**What's next:** TBD - milestone complete, ready for next feature development

---
