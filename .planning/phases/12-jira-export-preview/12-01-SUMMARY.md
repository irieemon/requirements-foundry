---
phase: 12-jira-export-preview
plan: 01
subsystem: export
tags: [jira, preview, tree, collapsible, shadcn]

# Dependency graph
requires:
  - phase: 11-data-display-hierarchy
    provides: Visual hierarchy patterns (StoryCard, SubtaskCard collapsible patterns)
provides:
  - getFullPreviewItems server action
  - ExportPreviewTree component
  - PreviewItem and FullPreviewData types
affects: [12-02-full-preview-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [nested collapsible tree, lightweight preview data types]

key-files:
  created:
    - components/export/export-preview-tree.tsx
  modified:
    - lib/export/jira/types.ts
    - lib/export/jira/index.ts
    - server/actions/jira-export.ts

key-decisions:
  - "PreviewItem is a lightweight projection of NormalizedItem (no descriptions/acceptance criteria)"
  - "Nested Collapsible structure mirrors Phase 11 card patterns"

patterns-established:
  - "Tree preview component with grouped items by parent-child relationships"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-20
---

# Phase 12 Plan 01: JIRA Export Preview Data Layer Summary

**Server action returning lightweight preview items with hierarchy counts, and collapsible tree component for epic→story→subtask display**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-20T22:52:39Z
- **Completed:** 2026-01-20T22:56:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `PreviewItem` and `FullPreviewData` types for lightweight export preview
- Implemented `getFullPreviewItems()` server action that returns items with story/subtask counts per parent
- Built `ExportPreviewTree` component with nested collapsibles matching Phase 11 visual patterns
- Priority badges use established MoSCoW color mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create getFullPreviewItems server action** - `6634a1e` (feat)
2. **Task 2: Create ExportPreviewTree component** - `bafce29` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `lib/export/jira/types.ts` - Added PreviewItem and FullPreviewData types
- `lib/export/jira/index.ts` - Exported new types
- `server/actions/jira-export.ts` - Added getFullPreviewItems() server action
- `components/export/export-preview-tree.tsx` - New collapsible tree component

## Decisions Made

- **Lightweight PreviewItem type:** Only includes display fields (no descriptions, acceptance criteria) to keep payload small for tree rendering
- **Nested Collapsible pattern:** Matches StoryCard/SubtaskCard expand/collapse behavior from Phase 11 for visual consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Server action ready to be called from preview page
- Tree component ready for integration
- Ready for 12-02: Full Preview Page Integration

---
*Phase: 12-jira-export-preview*
*Completed: 2026-01-20*
