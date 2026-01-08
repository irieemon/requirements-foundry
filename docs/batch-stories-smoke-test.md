# Batch Story Generation - Smoke Test Checklist

## Prerequisites

- [ ] Project with at least 2 epics exists
- [ ] At least one epic has existing stories (to test skip/replace modes)
- [ ] At least one epic has no stories (to test fresh generation)
- [ ] Development server running (`npm run dev`)

## Test 1: Button Visibility & State

- [ ] Navigate to project page → Epics section
- [ ] **Verify**: "Generate All Stories" button visible
- [ ] **Verify**: Button shows epic count badge (e.g., "5 epics")
- [ ] **Verify**: Button disabled if project has 0 epics

## Test 2: Config Dialog - Scope Step

- [ ] Click "Generate All Stories" button
- [ ] **Verify**: Dialog opens with 3-step stepper (Scope → Settings → Confirm)
- [ ] **Verify**: All epics pre-selected by default
- [ ] **Verify**: Can deselect individual epics
- [ ] **Verify**: "Select All" / "Deselect All" toggle works
- [ ] **Verify**: Epics with existing stories show badge (e.g., "5 stories")
- [ ] **Verify**: "Existing stories behavior" section appears when epics have stories
- [ ] **Verify**: Can toggle between "Skip existing" and "Replace existing"
- [ ] **Verify**: "Next" button disabled when no epics selected

## Test 3: Config Dialog - Settings Step

- [ ] Click "Next" to advance to Settings
- [ ] **Verify**: Generation mode selector works (Compact/Standard/Detailed)
- [ ] **Verify**: Description updates based on mode selection
- [ ] **Verify**: Persona set selector works (Lightweight/Core/Full)
- [ ] **Verify**: Persona list updates based on selection
- [ ] **Verify**: Pacing selector works (Safe/Normal/Fast)
- [ ] **Verify**: Delay time shown for each pacing option
- [ ] Click "Back" → **Verify**: Returns to Scope step with selections preserved

## Test 4: Config Dialog - Confirm Step

- [ ] Click "Next" to advance to Confirm
- [ ] **Verify**: Summary shows selected epic count
- [ ] **Verify**: Summary shows generation mode
- [ ] **Verify**: Summary shows persona set
- [ ] **Verify**: Summary shows processing speed
- [ ] **Verify**: Summary shows existing stories behavior (if applicable)
- [ ] **Verify**: Estimated stories count shown
- [ ] **Verify**: Estimated time shown
- [ ] **Verify**: "Start Generation" button visible

## Test 5: Batch Run Execution

- [ ] Click "Start Generation"
- [ ] **Verify**: Dialog closes
- [ ] **Verify**: Progress panel appears in Epics section
- [ ] **Verify**: "Generate All Stories" button hidden during active run

### Progress Panel Checks

- [ ] **Verify**: Phase timeline shows progress (Initialize → Queue Epics → Generate Stories → Finalize)
- [ ] **Verify**: Current phase highlighted
- [ ] **Verify**: Progress bar updates
- [ ] **Verify**: "X of Y epics processed" counter updates
- [ ] **Verify**: "X stories created" counter updates
- [ ] **Verify**: Current epic title shown during processing
- [ ] **Verify**: Time elapsed displayed
- [ ] **Verify**: Estimated remaining time displayed

### Epic Queue Panel Checks

- [ ] **Verify**: All epics listed in queue
- [ ] **Verify**: Current epic shows "Generating" or "Saving" status with pulse
- [ ] **Verify**: Completed epics show checkmark and story count
- [ ] **Verify**: Skipped epics show "Skipped" status (yellow)
- [ ] **Verify**: Failed epics show error status (red)
- [ ] **Verify**: Can expand epic row to see details

## Test 6: Run Completion

- [ ] Wait for run to complete
- [ ] **Verify**: Progress panel shows "Complete" status
- [ ] **Verify**: Toast notification appears with success message
- [ ] **Verify**: "View X Stories" button appears
- [ ] **Verify**: Close button (X) appears on panel
- [ ] Click "View X Stories" → **Verify**: Page refreshes with updated story count
- [ ] Close panel → **Verify**: "Generate All Stories" button reappears

## Test 7: Cancel Run

- [ ] Start a new batch run with multiple epics
- [ ] While running, click "Cancel" button
- [ ] **Verify**: Run stops after current epic completes
- [ ] **Verify**: Status changes to "Cancelled"
- [ ] **Verify**: Toast notification confirms cancellation
- [ ] **Verify**: Stories from completed epics are preserved

## Test 8: Retry Failed Epics

- [ ] Create a scenario where an epic fails (e.g., invalid data)
- [ ] Wait for run to complete with failures
- [ ] **Verify**: "Retry Failed (N)" button appears
- [ ] Click "Retry Failed"
- [ ] **Verify**: New run starts with only failed epics
- [ ] **Verify**: Original successful epics not re-processed

## Test 9: Skip Mode

- [ ] Start run with "Skip existing" selected
- [ ] Include epics that already have stories
- [ ] **Verify**: Epics with stories are skipped
- [ ] **Verify**: Skipped epics show in queue with "Skipped" status
- [ ] **Verify**: Existing stories preserved
- [ ] **Verify**: Final status shows skipped count

## Test 10: Replace Mode

- [ ] Start run with "Replace existing" selected
- [ ] Include epics that already have stories
- [ ] **Verify**: Existing stories deleted before generation
- [ ] **Verify**: Epic row shows "X stories deleted" in details
- [ ] **Verify**: New stories generated
- [ ] **Verify**: No duplicate stories

## Test 11: Pacing (Rate Limiting)

- [ ] Start run with "Fast" pacing (0.5s delay)
- [ ] Note completion time
- [ ] Start same run with "Safe" pacing (2s delay)
- [ ] **Verify**: Safe pacing takes noticeably longer

## Test 12: Error Resilience

- [ ] Simulate an error mid-run (if possible)
- [ ] **Verify**: Run continues to next epic
- [ ] **Verify**: Failed epic shows error message
- [ ] **Verify**: Run completes with "Partial" status
- [ ] **Verify**: Successful epics have their stories saved

## Test 13: Page Refresh During Run

- [ ] Start a batch run
- [ ] Refresh the page while run is active
- [ ] **Verify**: Progress panel reappears
- [ ] **Verify**: Progress resumes from current state
- [ ] **Verify**: No duplicate runs started

## Test 14: Concurrent Run Prevention

- [ ] Start a batch run
- [ ] Try to start another run (via API or different tab)
- [ ] **Verify**: Error message indicates run already in progress
- [ ] **Verify**: Only one run active at a time per project

## API Endpoint Tests

### GET /api/projects/[id]/active-batch-story-run

- [ ] **Verify**: Returns `{ runId: null }` when no active run
- [ ] **Verify**: Returns `{ runId: "..." }` when run active

### GET /api/runs/[id]/batch-story

- [ ] **Verify**: Returns progress data for valid run ID
- [ ] **Verify**: Returns 404 for invalid run ID
- [ ] **Verify**: Returns 404 for non-batch-story run type

## Edge Cases

- [ ] Start run with 0 epics selected → Error message
- [ ] Start run with no API key configured → Error in logs, graceful failure
- [ ] Start run with very long epic titles → No UI overflow
- [ ] Start run on mobile viewport → Responsive layout

## Performance Checks

- [ ] Large batch (10+ epics) runs without UI freeze
- [ ] Progress updates smoothly (no flicker)
- [ ] Memory usage reasonable during long runs

---

**Test Date**: _______________

**Tester**: _______________

**Environment**:
- [ ] Development
- [ ] Staging
- [ ] Production

**Notes**:
