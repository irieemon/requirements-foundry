# Vercel Batch Story Generation - Acceptance Criteria

## Problem Context

This document defines acceptance criteria specifically for resolving Vercel deployment issues:

1. **Story generation hangs on Vercel** - Works locally but stalls in production
2. **Runs stuck in "already running" state** - No recovery mechanism for stale runs
3. **Progress visualization unreliable** - Client polling shows inconsistent state
4. **Client disconnects cause incomplete runs** - Browser close interrupts processing

---

## Architecture Overview (Current)

The current implementation uses a **continuation pattern**:

```
User Request
    │
    ▼
startGenerateAllStories()
    │
    ├── Creates Run record (QUEUED)
    ├── Creates RunEpic records (PENDING)
    └── triggerProcessNext(runId) [fire-and-forget]
            │
            ▼
      /api/runs/[id]/process-next
            │
            ├── Process ONE epic
            ├── Update RunEpic status
            └── triggerProcessNext(runId) [continue chain]
                    │
                    ▼
              (repeat until no PENDING epics)
                    │
                    ▼
              finalizeRun()
```

**Key Configuration:**
- `maxDuration: 120` seconds per process-next invocation
- `vercel.json`: `maxDuration: 300` for all functions
- No heartbeat mechanism currently implemented

---

## Acceptance Criteria (Gherkin Format)

### Feature: Client Disconnect Resilience

```gherkin
Feature: Run continues after client disconnect
  As a user who may close their browser accidentally
  I want my story generation to continue running
  So that I don't lose progress on long-running tasks

  Background:
    Given a project with 5 epics exists
    And the batch story generation has been started
    And 2 epics have completed successfully

  Scenario: Browser tab closed mid-run
    When the user closes the browser tab
    Then the server continues processing remaining epics
    And the run completes with status SUCCEEDED or PARTIAL
    And all completed stories are persisted in the database
    And the run log contains entries for all processed epics

  Scenario: Network disconnection during processing
    When the network connection is lost for 30 seconds
    And the connection is restored
    Then the client polling resumes from the last known state
    And the progress UI shows the current accurate state
    And no duplicate processing occurs

  Scenario: Multiple tab reconnection
    Given the user opens the project in a new tab
    When polling begins on the new tab
    Then the progress UI shows the current run state
    And the run ID matches the active run
    And epic statuses reflect their actual database state
```

### Feature: Progress Persistence

```gherkin
Feature: Progress survives page refresh
  As a user monitoring a long-running generation
  I want to see current progress after page refresh
  So that I can track the operation reliably

  Scenario: Page refresh during active run
    Given a batch story run is in progress at 40% completion
    When the user refreshes the browser page
    Then the page loads with the active run detected
    And the progress panel appears automatically
    And the progress bar shows approximately 40%
    And the current epic is highlighted
    And the elapsed time counter continues accurately

  Scenario: Progress after extended absence
    Given a batch story run has been running for 10 minutes
    And the user has been on a different tab
    When the user returns to the project page
    Then the progress UI shows the current state
    And completed epics display their story counts
    And failed epics show their error messages
    And the estimated remaining time is recalculated

  Scenario: Run completes while user is away
    Given a batch story run is in progress
    And the user navigates to a different page
    When the run completes
    And the user returns to the project page
    Then the page shows the completion state
    And a success notification is displayed
    And the new story counts are visible
```

### Feature: Stale Run Recovery

```gherkin
Feature: Automatic recovery from stale runs
  As a user who experienced a server error
  I want stale runs to be automatically detected
  So that I can start new generations without manual intervention

  Background:
    Given a run exists with status RUNNING
    And the run's last update was over 10 minutes ago
    And no heartbeat has been recorded for 5 minutes

  Scenario: Stale run detection on new generation attempt
    When a user attempts to start a new batch story generation
    Then the system detects the stale run condition
    And the stale run is marked as FAILED with reason "Timeout - no heartbeat"
    And a new run is allowed to start
    And the user is notified of the recovered stale run

  Scenario: Manual stale run recovery
    When the user clicks "Clear Stale Run" button
    Then the stale run is marked as FAILED
    And the "Generate All Stories" button becomes enabled
    And the user can start a fresh run

  Scenario: Heartbeat keeps run alive
    Given a run is actively processing epics
    When an epic completes processing
    Then the run's heartbeat timestamp is updated
    And the run is not considered stale
    And continuation processing proceeds normally

  Scenario: Vercel cold start does not cause stale detection
    Given a run was started 3 minutes ago
    And the Vercel function experienced a cold start delay of 10 seconds
    When the function resumes processing
    Then the run is not marked as stale
    And processing continues normally
```

### Feature: Consistent Progress Visualization

```gherkin
Feature: Real-time progress updates without infinite spinners
  As a user watching the generation progress
  I want reliable visual feedback
  So that I know the system is working

  Scenario: Immediate visual feedback on run start
    When a user starts a batch story generation
    Then a progress panel appears within 500ms
    And the progress bar shows 0% initially
    And the phase shows "Initializing"
    And a loading indicator is visible

  Scenario: Epic status updates in real-time
    Given a batch story run is in progress
    When an epic transitions from PENDING to GENERATING
    Then the epic row shows "Generating" status within 2 seconds
    And a pulse animation indicates activity
    And the progress percentage updates

  Scenario: No stuck spinner state
    Given a batch story run has been running for 5 minutes
    And no progress has been made for 2 minutes
    Then the UI shows a "stalled" indicator
    And an error message suggests possible issues
    And a "Cancel" or "Retry" option is provided

  Scenario: Progress bar accuracy
    Given a run with 10 epics is in progress
    When 4 epics are completed (3 success, 1 skipped)
    Then the progress bar shows 40%
    And the counter shows "4 of 10 epics processed"
    And the story count reflects actual created stories

  Scenario: Error state visualization
    Given a run is processing and an epic fails
    When the failure is recorded
    Then the epic row shows red error indicator within 2 seconds
    And the error message is visible on expansion
    And the overall progress continues to other epics
    And the run status remains RUNNING until completion
```

### Feature: Retry Idempotency

```gherkin
Feature: Safe retry of failed epics
  As a user with partially failed generation
  I want to retry only the failed parts
  So that I don't duplicate work or create duplicate stories

  Scenario: Retry creates independent run
    Given a run completed with status PARTIAL
    And 3 of 5 epics succeeded
    And 2 epics failed
    When the user clicks "Retry Failed Epics"
    Then a new Run record is created
    And the new run contains only the 2 failed epicIds
    And the original run remains unchanged

  Scenario: No duplicate stories on retry
    Given a run where epic E3 failed after partial story creation
    And 2 stories were created before failure
    When the user retries failed epics
    And E3 is processed in the new run
    Then the previous 2 partial stories are deleted
    And new stories are generated fresh
    And no duplicate story codes exist

  Scenario: Retry during concurrent run prevention
    Given a retry run is in progress
    When the user attempts another retry
    Then an error message is displayed
    And no new run is created
    And the existing retry continues

  Scenario: Multiple retry attempts
    Given a run has been retried 3 times
    And all retries failed for the same epic
    When the user attempts a 4th retry
    Then the retry is allowed
    And the retry count is tracked
    And the user is warned about repeated failures
```

---

## Test Scenarios Matrix

### Integration Tests

| ID | Scenario | Vercel-Specific | Priority | Automated |
|----|----------|-----------------|----------|-----------|
| INT-001 | Start run returns immediately with runId | Yes | Critical | Yes |
| INT-002 | Process-next completes within 120s | Yes | Critical | Yes |
| INT-003 | Chain continues across function invocations | Yes | Critical | Yes |
| INT-004 | Stale run detected after 10 minutes | Yes | High | Yes |
| INT-005 | Heartbeat updated on epic completion | Yes | High | Yes |
| INT-006 | Cancel flag checked before processing | Yes | High | Yes |
| INT-007 | Concurrent run prevention works | Yes | Critical | Yes |
| INT-008 | Database writes survive function timeout | Yes | Critical | Yes |
| INT-009 | Fire-and-forget trigger reaches endpoint | Yes | High | Yes |
| INT-010 | Secret validation blocks unauthorized calls | Yes | Medium | Yes |

### E2E Tests (Vercel Deployment)

| ID | Scenario | Environment | Priority | Manual/Auto |
|----|----------|-------------|----------|-------------|
| E2E-001 | Full run completion with 5 epics | Vercel Preview | Critical | Auto |
| E2E-002 | Tab close and reconnect shows progress | Vercel Preview | Critical | Manual |
| E2E-003 | Page refresh preserves progress | Vercel Preview | High | Auto |
| E2E-004 | Cancel mid-run stops processing | Vercel Preview | High | Auto |
| E2E-005 | Retry failed epics works | Vercel Preview | High | Auto |
| E2E-006 | 10+ epic run completes | Vercel Production | High | Auto |
| E2E-007 | Rate limiting handled gracefully | Vercel Production | Medium | Manual |
| E2E-008 | Cold start doesn't break continuation | Vercel Preview | High | Manual |

### Load/Stress Tests

| ID | Scenario | Metric | Target | Threshold |
|----|----------|--------|--------|-----------|
| LOAD-001 | Sequential epic processing | Duration per epic | <30s | <60s |
| LOAD-002 | 10 epic batch completion | Total duration | <5 min | <10 min |
| LOAD-003 | 25 epic batch completion | Total duration | <15 min | <20 min |
| LOAD-004 | Heartbeat survival during slow epic | Heartbeat gap | <60s | <120s |
| LOAD-005 | Concurrent project runs (different projects) | Success rate | 100% | 95% |

---

## Edge Cases Catalog

### Category: Serverless Runtime

| # | Edge Case | Expected Behavior | Test Method |
|---|-----------|-------------------|-------------|
| EC-01 | Function timeout at 119s | Current epic fails, chain continues | Inject slow AI response |
| EC-02 | Cold start delays (5-10s) | No false stale detection | Monitor after idle period |
| EC-03 | Concurrent function executions | Only one processes, others return early | Rapid trigger attempts |
| EC-04 | Memory limit approached | Graceful failure, error logged | Large story generation |
| EC-05 | Database connection pool exhausted | Retry with backoff | High concurrent load |

### Category: Network/Infrastructure

| # | Edge Case | Expected Behavior | Test Method |
|---|-----------|-------------------|-------------|
| EC-06 | Fire-and-forget fails (network blip) | Run stalls, detected as stale | Block outbound fetch |
| EC-07 | Database write timeout | Epic marked failed, chain continues | Inject DB delay |
| EC-08 | Claude API rate limit (429) | Retry with exponential backoff | Hit rate limit |
| EC-09 | Claude API timeout | Epic fails, error recorded | Inject timeout |
| EC-10 | VERCEL_URL not available | Fallback URL construction works | Test without env var |

### Category: Data Integrity

| # | Edge Case | Expected Behavior | Test Method |
|---|-----------|-------------------|-------------|
| EC-11 | Partial story creation before failure | Stories cleaned up on retry | Kill mid-insert |
| EC-12 | Duplicate epic in runEpics | Only processed once | Manual DB insert |
| EC-13 | Epic deleted during run | Epic marked failed, run continues | Delete via API |
| EC-14 | Project deleted during run | Run marked failed immediately | Delete via API |
| EC-15 | Run config JSON malformed | Defaults applied, warning logged | Corrupt inputConfig |

### Category: User Actions

| # | Edge Case | Expected Behavior | Test Method |
|---|-----------|-------------------|-------------|
| EC-16 | Cancel during SAVING state | Current epic completes, then stop | Cancel at save |
| EC-17 | Cancel, then retry immediately | Retry blocked until cancel completes | Rapid cancel+retry |
| EC-18 | Multiple browser tabs polling | Same state returned, no conflicts | Open 3 tabs |
| EC-19 | User deletes epic during run | Epic skipped, continues to others | Delete via UI |
| EC-20 | User manually modifies stories during run | No interference with generation | Edit existing story |

---

## Regression Checklist

### Pre-Deployment

- [ ] All unit tests pass (`npm test`)
- [ ] Build completes without errors (`npm run build`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Local development works with mock provider
- [ ] Local development works with real Anthropic API

### Vercel Preview Deployment

- [ ] Preview deployment succeeds
- [ ] Health check endpoint responds (`/api/health`)
- [ ] Database connection works (Turso/Libsql)
- [ ] Environment variables loaded correctly
- [ ] BATCH_STORY_SECRET configured
- [ ] Function logs visible in Vercel dashboard

### Functional Verification (Preview)

- [ ] Start batch story run - immediate response
- [ ] Progress polling returns data
- [ ] Epic processing completes
- [ ] Stories created in database
- [ ] Run finalization works
- [ ] Cancel run works
- [ ] Retry failed works (if applicable)

### UI Verification

- [ ] Generate All Stories button visible
- [ ] Progress panel renders correctly
- [ ] Progress bar updates
- [ ] Epic queue shows statuses
- [ ] Completion toast appears
- [ ] Error states display correctly

### Production Deployment

- [ ] Production deployment succeeds
- [ ] Existing runs data not corrupted
- [ ] Active runs (if any) continue working
- [ ] New runs start correctly
- [ ] No duplicate run prevention false positives

---

## Smoke Test Script

```bash
#!/bin/bash
# Post-Deployment Smoke Test for Batch Story Generation
# Usage: ./smoke-test.sh <BASE_URL> <PROJECT_ID>

set -e

BASE_URL="${1:-https://your-app.vercel.app}"
PROJECT_ID="${2:-test-project-id}"
BATCH_SECRET="${BATCH_STORY_SECRET:-dev-batch-secret-not-for-production}"

echo "=== Batch Story Generation Smoke Test ==="
echo "Base URL: $BASE_URL"
echo "Project ID: $PROJECT_ID"
echo ""

# Test 1: Health Check
echo "[1/7] Health Check..."
HEALTH=$(curl -s "$BASE_URL/api/health")
if [[ "$HEALTH" == *"ok"* ]]; then
  echo "  ✓ Health check passed"
else
  echo "  ✗ Health check failed: $HEALTH"
  exit 1
fi

# Test 2: Check for Active Run (should be none)
echo "[2/7] Checking for active runs..."
ACTIVE=$(curl -s "$BASE_URL/api/projects/$PROJECT_ID/active-batch-story-run")
if [[ "$ACTIVE" == *"null"* ]]; then
  echo "  ✓ No active runs"
else
  echo "  ! Warning: Active run exists: $ACTIVE"
fi

# Test 3: Start a Batch Run (requires authentication - adapt as needed)
echo "[3/7] Starting batch story run..."
# Note: This requires proper authentication. Adjust based on your auth setup.
# START_RESULT=$(curl -s -X POST "$BASE_URL/api/batch-stories/start" \
#   -H "Content-Type: application/json" \
#   -d "{\"projectId\": \"$PROJECT_ID\", \"options\": {\"mode\": \"compact\"}}")
echo "  - Skipped (requires auth setup)"

# Test 4: Verify process-next endpoint responds to unauthorized calls
echo "[4/7] Testing process-next authorization..."
AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/runs/fake-run-id/process-next" \
  -H "Content-Type: application/json")
if [[ "$AUTH_TEST" == "401" ]]; then
  echo "  ✓ Unauthorized requests blocked (401)"
else
  echo "  ✗ Expected 401, got: $AUTH_TEST"
fi

# Test 5: Verify progress endpoint
echo "[5/7] Testing progress endpoint..."
PROGRESS_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/runs/fake-run-id")
if [[ "$PROGRESS_TEST" == "404" ]]; then
  echo "  ✓ Unknown run returns 404"
else
  echo "  ✗ Expected 404, got: $PROGRESS_TEST"
fi

# Test 6: Verify batch-story progress endpoint
echo "[6/7] Testing batch-story progress endpoint..."
BATCH_PROGRESS_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/runs/fake-run-id/batch-story")
if [[ "$BATCH_PROGRESS_TEST" == "404" ]]; then
  echo "  ✓ Unknown batch run returns 404"
else
  echo "  ✗ Expected 404, got: $BATCH_PROGRESS_TEST"
fi

# Test 7: Response time check
echo "[7/7] Checking response times..."
TIME_START=$(date +%s%3N)
curl -s "$BASE_URL/api/health" > /dev/null
TIME_END=$(date +%s%3N)
DURATION=$((TIME_END - TIME_START))
if [[ $DURATION -lt 2000 ]]; then
  echo "  ✓ Response time acceptable (${DURATION}ms)"
else
  echo "  ! Warning: Slow response (${DURATION}ms)"
fi

echo ""
echo "=== Smoke Test Complete ==="
echo "Note: Full functional testing requires a valid project with epics."
```

---

## Monitoring Recommendations

### Vercel Logs to Watch

```
[BatchStory] Triggering process-next for run *
[ProcessNext *] Starting...
[ProcessNext *] Processing epic *
[ProcessNext *] Completed * stories
[ProcessNext *] Run finalized with status: *
```

### Error Patterns to Alert On

1. `[ProcessNext *] Fatal error:` - Function-level failure
2. `Failed to trigger process-next:` - Chain broken
3. `Invalid or missing batch secret` - Security issue
4. Multiple `Starting...` logs for same run in short time - Race condition

### Key Metrics

| Metric | Normal Range | Alert Threshold |
|--------|--------------|-----------------|
| Epic processing time | 5-30s | >60s |
| Total run duration (10 epics) | 2-5 min | >10 min |
| Function invocations per epic | 1 | >3 |
| Error rate per run | 0% | >20% |

---

## Implementation Gaps Identified

Based on the acceptance criteria, the following gaps exist in the current implementation:

### Gap 1: No Heartbeat Mechanism

**Current State:** Run has no heartbeat field; stale detection not implemented.

**Required:**
- Add `heartbeatAt` field to Run model
- Update heartbeat on each epic completion
- Implement stale detection check (>10 min without heartbeat)
- Add "Clear Stale Run" UI action

### Gap 2: No Stale Run Auto-Recovery

**Current State:** Runs stuck in RUNNING state block new runs indefinitely.

**Required:**
- Check for stale runs on new generation attempt
- Auto-mark stale runs as FAILED
- Notify user of recovered runs

### Gap 3: Progress UI Stall Detection

**Current State:** UI shows spinner indefinitely if polling fails or run stalls.

**Required:**
- Track last progress update time
- Show "stalled" indicator after 2 minutes no change
- Provide retry/cancel actions for stalled state

### Gap 4: Partial Story Cleanup on Retry

**Current State:** Retry does not clean up partial stories from failed epic.

**Required:**
- Before retry processing, delete any stories with runId matching the epic's previous attempt
- Or use REPLACE mode behavior for retry

---

*Document Version: 1.0*
*Created: 2025-01-09*
*Author: QA Agent*
*Status: Defining acceptance criteria for Vercel fix*
