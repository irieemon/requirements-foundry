# Phase 11 Plan 02: Story Card Layout Summary

**Replaced story tables with collapsible card components matching EpicCard visual language.**

## Accomplishments

- Created `StoryCard` component with Collapsible expand/collapse behavior
- Priority badges color-coded using MoSCoW colors (Must=red, Should=amber, Could=blue, Won't=slate)
- Subtask count badge displays when story has associated subtasks
- StoriesSection now renders StoryCard list instead of table rows

## Files Created/Modified

- `components/stories/story-card.tsx` - New presentational component with collapsible details
- `components/stories/stories-section.tsx` - Updated to use StoryCard instead of StoryTable

## Decisions Made

- Used inline Story interface instead of indexed access type (`StoryCardProps["story"]`) due to Turbopack parser limitation
- Kept StoryTable file intact (not deleted) in case it's referenced elsewhere or needed for comparison

## Issues Encountered

- Turbopack's SWC parser doesn't support TypeScript indexed access types in interface extends clauses - resolved by inlining the type definition

## Next Step

Ready for 11-03-PLAN.md (Subtask Display Polish)
