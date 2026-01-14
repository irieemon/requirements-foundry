# Phase 6 Plan 1: Stories Page Summary

**Add stories section to project detail page**

## Accomplishments

- Extended `getProject` to include full story data nested within epics (code, title, userStory, persona, acceptanceCriteria, technicalNotes, priority, effort)
- Added stories KPI card to navigation strip with computed total count across all epics
- Created `StoriesSection` component that displays stories grouped by their parent epic
- Extended `NavigableKpiCard` to support `ScrollText` icon for stories

## Files Created/Modified

- `server/actions/projects.ts` - Extended epics include to fetch nested stories
- `app/projects/[id]/page.tsx` - Added stories section, KPI card, and computed totalStories
- `components/stories/stories-section.tsx` - New component displaying stories grouped by epic
- `components/ui/navigable-kpi-card.tsx` - Added ScrollText to icon whitelist

## Architecture Decisions

- Stories are fetched as part of epics (not separate query) since they don't have direct project relation
- Total story count computed client-side from `epics.reduce()` to avoid extra DB query
- Reused existing `StoryTable` component to avoid duplication
- Each epic with stories displayed in its own Card for visual grouping

## Verification

- Build succeeds without errors
- Stories section accessible via `?section=stories`
- KPI card shows accurate total story count
- Stories grouped by epic with expandable rows
- Empty state displays when no stories exist

## Next Step

Phase 6.01 complete. Stories section now available on project detail page.
