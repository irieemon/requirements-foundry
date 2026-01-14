# Phase 07-02 Summary: Server Actions and Executor

## Completed

### Type Definitions (lib/types.ts)
- Added `GENERATE_SUBTASKS` to RunType enum
- Added `RunStoryStatus` enum (PENDING, GENERATING, SAVING, COMPLETED, FAILED, SKIPPED)
- Added `QUEUEING_STORIES` and `GENERATING_SUBTASKS` to RunPhase enum
- Created `GenerateSubtasksInput`, `GenerateSubtasksResult` interfaces
- Created `RunStoryProgress`, `BatchSubtaskProgress` interfaces for progress tracking

### AI Provider (lib/ai/provider.ts)
- Added `generateSubtasks` method to `AIProvider` interface
- Implemented `generateSubtasks` in `AnthropicProvider`:
  - Uses claude-sonnet-4-20250514 model
  - Generates mode-appropriate subtask counts (compact: 3-5, standard: 5-8, detailed: 8-12)
  - Returns SubtaskData[] with code, title, description, effort
- Implemented mock `generateSubtasks` in `MockProvider`:
  - 800ms simulated delay
  - Deterministic template-based subtasks for testing

### Server Actions (server/actions/subtasks.ts)
- `startGenerateSubtasks`: Initiates batch subtask generation
  - Validates epic and stories exist
  - Checks for active runs (prevents duplicates)
  - Creates Run and RunStory junction records
  - Triggers async processing via process-next
- `getBatchSubtaskProgress`: Returns current progress for frontend polling
  - Includes per-story status, subtask counts, timing estimates
- `cancelBatchSubtaskRun`: Marks run as cancelled
- `retryFailedStories`: Starts new run with only failed stories
- `getActiveSubtaskRun`: Checks for active runs with stale detection
- `getStoriesForSubtaskGeneration`: Lists stories with subtask counts

### Subtask Executor (lib/run-engine/subtask-executor.ts)
- `executeSubtaskGeneration`: Main processing loop
  - Processes all pending RunStory records
  - Handles skip/replace existing subtasks
  - Updates heartbeat for stale detection
  - Applies pacing delays between stories
  - Returns on timeout for continuation
- `finalizeSubtaskRun`: Aggregates results and sets final status
- Follows same patterns as batch-story-executor

### Process-Next Route Integration (app/api/runs/[id]/process-next/route.ts)
- Added RunType import
- Added subtask executor import
- Added dispatch logic for GENERATE_SUBTASKS runs
- Routes to subtask executor or original story executor based on run.type
- Handles timeout continuation for both run types

## Verification Results

| Check | Status |
|-------|--------|
| `npx tsc --noEmit` | ✅ Passed (only pre-existing test errors) |
| `npm run build` | ✅ Succeeded |
| Server actions compile | ✅ Confirmed |
| Executor follows pattern | ✅ Matches batch-story-executor |
| Route handles both types | ✅ Dispatches correctly |

## Architecture

```
startGenerateSubtasks (Server Action)
    ↓
Creates Run + RunStory records
    ↓
triggerProcessNextAsync
    ↓
/api/runs/[id]/process-next
    ↓
Dispatches based on run.type:
  - GENERATE_ALL_STORIES → inline epic processing
  - GENERATE_SUBTASKS → executeSubtaskGeneration()
```

## Files Created/Modified

**Created:**
- `server/actions/subtasks.ts` - Server actions for subtask generation
- `lib/run-engine/subtask-executor.ts` - Executor for processing stories

**Modified:**
- `lib/types.ts` - Added RunType, RunStoryStatus, RunPhase values and interfaces
- `lib/ai/provider.ts` - Added generateSubtasks to AIProvider interface and implementations
- `app/api/runs/[id]/process-next/route.ts` - Added GENERATE_SUBTASKS dispatch

## Next Steps

Phase 07-03: Create UI components for triggering subtask generation from epic/stories pages
