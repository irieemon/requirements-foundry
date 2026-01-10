# Test Plan: Generate ALL Stories Feature

## Overview
This test plan covers the batch story generation feature that generates stories for all epics in a project sequentially, with progress tracking, cancellation support, and retry capability.

**Feature Summary:**
- Generates stories for all epics in a project in sequence
- Tracks progress via polling (RunEpic records)
- Supports cancellation mid-run
- Supports retry for failed epics
- Handles skip/replace modes for existing stories
- Works with both real API (Anthropic) and Mock provider

---

## 1. Test Case Table

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority |
|----|----------|-------------|---------------|-------|-----------------|----------|
| **Happy Path Tests** |
| TC-HP-001 | Happy Path | Project with 3 epics, all succeed | Project with 3 epics, no existing stories | 1. Navigate to project<br>2. Click "Generate ALL Stories"<br>3. Wait for completion | - 3 RunEpic records with status COMPLETED<br>- Story count per mode (compact: 5-8, standard: 8-12)<br>- Success toast with stats | Critical |
| TC-HP-002 | Happy Path | Verify story count matches mode | Project with 1 epic | 1. Select "compact" mode<br>2. Generate stories | 5-8 stories created | High |
| TC-HP-003 | Happy Path | Verify story count matches mode | Project with 1 epic | 1. Select "standard" mode<br>2. Generate stories | 8-12 stories created | High |
| TC-HP-004 | Happy Path | Verify story count matches mode | Project with 1 epic | 1. Select "detailed" mode<br>2. Generate stories | 12-15 stories created | High |
| TC-HP-005 | Happy Path | Progress updates in real-time | Project with 5 epics | 1. Start generation<br>2. Monitor progress bar | Progress bar updates smoothly with each epic completion | High |
| TC-HP-006 | Happy Path | Completion toast accuracy | Project with 3 epics | 1. Generate stories<br>2. Wait for completion | Toast shows: "Generated X stories for 3 epics" with accurate counts | Medium |
| **Zero Epics Edge Case** |
| TC-ZE-001 | Edge Case | Button disabled when no epics | Project with 0 epics | 1. Navigate to project | - Button disabled<br>- Tooltip: "Generate epics first" | High |
| TC-ZE-002 | Edge Case | API returns error for no epics | Project with 0 epics | 1. Call API directly via REST | Response: `{ success: false, error: "No epics to process" }` | High |
| **Many Epics (20+)** |
| TC-ME-001 | Edge Case | Project with 25 epics | Project with 25 epics | 1. Click "Generate ALL Stories"<br>2. Wait for completion | - All 25 epics processed<br>- Run completes within 300s timeout | High |
| TC-ME-002 | Edge Case | Pacing delays applied | Project with 25 epics, Safe pacing | 1. Start generation<br>2. Monitor timing | Delays between API calls prevent rate limiting | Medium |
| TC-ME-003 | Edge Case | Progress bar smooth updates | Project with 25 epics | 1. Start generation<br>2. Monitor UI | Progress bar updates incrementally (not jumping) | Medium |
| **Existing Stories - Skip Mode** |
| TC-ES-001 | Edge Case | Skip mode - has existing stories | Epic with 5 existing stories | 1. Select "Skip" mode<br>2. Generate | - RunEpic status = SKIPPED<br>- skippedEpics counter increments<br>- Existing 5 stories preserved | High |
| TC-ES-002 | Edge Case | Skip mode - partial coverage | 3 epics: 1 with stories, 2 without | 1. Select "Skip" mode<br>2. Generate | - 1 SKIPPED, 2 COMPLETED<br>- Existing stories unchanged | High |
| **Existing Stories - Replace Mode** |
| TC-ER-001 | Edge Case | Replace mode - has existing stories | Epic with 5 existing stories | 1. Select "Replace" mode<br>2. Generate | - Old 5 stories deleted<br>- New stories created<br>- Story count updated correctly | High |
| TC-ER-002 | Edge Case | Replace mode - verify cleanup | Epic with 10 existing stories | 1. Select "Replace" mode<br>2. Generate (mode: compact) | - Exactly 5-8 stories remain (not 15-18)<br>- Old stories completely gone | High |
| **Mock Mode (No API Key)** |
| TC-MM-001 | Edge Case | MockProvider used when no key | ANTHROPIC_API_KEY not set | 1. Verify env var unset<br>2. Generate stories | - MockProvider log message appears<br>- Deterministic fake stories created | High |
| TC-MM-002 | Edge Case | Sequential processing in mock | 3 epics, no API key | 1. Generate stories<br>2. Check order | - Epics processed in order<br>- Mock delays (1200ms each) applied | Medium |
| TC-MM-003 | Edge Case | Faster completion in mock | 5 epics, no API key | 1. Generate stories<br>2. Measure time | - Completes faster than real API<br>- ~6s total (5 x 1.2s delay) | Low |
| **Mid-Run Cancellation** |
| TC-MC-001 | Edge Case | Cancel after partial completion | 10 epics, generation running | 1. Start generation<br>2. Wait for 3 epics to complete<br>3. Click "Cancel" | - 3 COMPLETED, 7 PENDING (not CANCELLED)<br>- Run.status = CANCELLED<br>- "Retry" button visible | Critical |
| TC-MC-002 | Edge Case | Cancelled epic not marked failed | 10 epics, cancel mid-run | 1. Cancel mid-run<br>2. Check RunEpic statuses | Pending epics remain PENDING, not FAILED or CANCELLED | High |
| TC-MC-003 | Edge Case | Stories preserved on cancel | 10 epics, cancel after 3 | 1. Cancel mid-run<br>2. Check stories | Stories from completed epics are preserved | High |
| **Single Epic Failure** |
| TC-SF-001 | Edge Case | Epic 3 of 5 fails | 5 epics, API error on epic 3 | 1. Inject API error for epic 3<br>2. Generate stories | - Epics 1,2,4,5 COMPLETED<br>- Epic 3 FAILED<br>- Run.status = SUCCEEDED (partial) | High |
| TC-SF-002 | Edge Case | Retry Failed button appears | Previous: 1 epic failed | 1. Check UI after partial failure | "Retry Failed" button appears | High |
| TC-SF-003 | Edge Case | Retry processes only failed | 1 epic failed from previous run | 1. Click "Retry Failed"<br>2. Monitor | - New run created<br>- Only failed epic processed | High |
| **All Epics Fail** |
| TC-AF-001 | Edge Case | API down scenario | 3 epics, API errors for all | 1. Simulate API down<br>2. Generate stories | - All RunEpics = FAILED<br>- Run.status = FAILED | High |
| TC-AF-002 | Edge Case | Appropriate error message | All epics failed | 1. Check error display | Error message indicates API failure | Medium |
| TC-AF-003 | Edge Case | Retry available after total failure | All epics failed | 1. Check UI | "Retry" button available | Medium |
| **Retry Behavior** |
| TC-RB-001 | Edge Case | Retry creates new run | Previous run with 2 failures | 1. Click "Retry Failed" | - New Run record created<br>- Original run unchanged | High |
| TC-RB-002 | Edge Case | Retry only processes failures | Previous: 3 succeeded, 2 failed | 1. Click "Retry Failed"<br>2. Check processed epics | Only 2 failed epicIds in new run | High |
| TC-RB-003 | Edge Case | Original run immutable | After retry | 1. Check original run | Original run status/data unchanged | Medium |
| **Concurrent Run Prevention** |
| TC-CR-001 | Edge Case | Prevent duplicate runs | Run already in progress | 1. Start run<br>2. Attempt to start another | Error: "A story generation is already in progress" | Critical |
| TC-CR-002 | Edge Case | No duplicate run records | Attempt concurrent runs | 1. Try concurrent starts<br>2. Check database | Only 1 run record exists for the batch | High |
| TC-CR-003 | Edge Case | Button disabled during run | Run in progress | 1. Check button state | Button disabled with loading indicator | Medium |
| **No Duplicate Stories** |
| TC-ND-001 | Edge Case | Manual retry same epic | Epic 1 completed, retry triggered | 1. Complete run for epic<br>2. Trigger retry manually | - Old stories replaced (not appended)<br>- Story count unchanged | High |
| TC-ND-002 | Edge Case | Replace preserves count | 10 stories exist, regenerate | 1. Regenerate with same mode | Story count remains in expected range (not doubled) | High |
| **Performance Tests** |
| TC-PF-001 | Performance | 10 epics standard mode duration | 10 epics, Standard mode, Fast pacing | 1. Start generation<br>2. Measure total time | Duration < 2 minutes | Medium |
| TC-PF-002 | Performance | 10 epics safe pacing duration | 10 epics, Standard mode, Safe pacing | 1. Start generation<br>2. Measure total time | Duration < 5 minutes | Medium |
| TC-PF-003 | Performance | Memory usage stable | 25 epics | 1. Monitor memory during run | Memory doesn't grow unbounded | Low |
| **UI State Tests** |
| TC-UI-001 | UI State | Button disabled during run | Run in progress | 1. Check button state | Generate button disabled | High |
| TC-UI-002 | UI State | Progress bar accuracy | 5 epics running | 1. Complete 2 epics<br>2. Check progress | Progress shows ~40% (2/5) | High |
| TC-UI-003 | UI State | Epic list scrolls to current | 15 epics, running | 1. Start run<br>2. Observe epic list | List auto-scrolls to currently processing epic | Low |
| TC-UI-004 | UI State | Failed epic expandable | 1 epic failed | 1. Click failed epic row | Error details expandable/visible | Medium |
| TC-UI-005 | UI State | Success state indicators | All completed | 1. Check completed epics | Green checkmarks on completed epics | Medium |

---

## 2. Edge Case Coverage Matrix

| Edge Case | Test Coverage | Risk Level | Mitigation Strategy |
|-----------|--------------|------------|---------------------|
| Zero epics | TC-ZE-001, TC-ZE-002 | Medium | Button disabled + API validation |
| Many epics (20+) | TC-ME-001, TC-ME-002, TC-ME-003 | High | Pacing delays, timeout configuration |
| Existing stories (Skip) | TC-ES-001, TC-ES-002 | High | Check story count before processing |
| Existing stories (Replace) | TC-ER-001, TC-ER-002 | High | DELETE before INSERT in transaction |
| No API key | TC-MM-001, TC-MM-002, TC-MM-003 | Low | MockProvider fallback |
| Mid-run cancellation | TC-MC-001, TC-MC-002, TC-MC-003 | Critical | Cancellation token pattern |
| Single epic failure | TC-SF-001, TC-SF-002, TC-SF-003 | High | Continue-on-error + retry |
| All epics fail | TC-AF-001, TC-AF-002, TC-AF-003 | Medium | Clear error messaging + retry |
| Retry behavior | TC-RB-001, TC-RB-002, TC-RB-003 | High | New run with failed epicIds only |
| Concurrent runs | TC-CR-001, TC-CR-002, TC-CR-003 | Critical | Database check + optimistic locking |
| Duplicate stories | TC-ND-001, TC-ND-002 | High | DELETE-then-INSERT pattern |
| Performance | TC-PF-001, TC-PF-002, TC-PF-003 | Medium | Pacing options + timeout limits |

---

## 3. Mock Scenarios Needed

### 3.1 API Mock Scenarios

```typescript
// mock-scenarios.ts

export const mockScenarios = {
  // Scenario 1: All succeed
  allSucceed: {
    description: "All API calls succeed normally",
    behavior: "Return valid story data for each epic",
    delay: 1200, // ms
    errorRate: 0
  },

  // Scenario 2: Random failures
  randomFailures: {
    description: "Random epics fail with API errors",
    behavior: "30% chance of failure per epic",
    delay: 1200,
    errorRate: 0.3
  },

  // Scenario 3: Specific epic fails
  epicThreeFails: {
    description: "Epic at index 2 (third) always fails",
    behavior: "Throw error for epicIndex === 2",
    delay: 1200,
    failingIndices: [2]
  },

  // Scenario 4: API down (all fail)
  apiDown: {
    description: "All API calls fail",
    behavior: "Always throw error",
    delay: 100, // Fast fail
    errorRate: 1.0
  },

  // Scenario 5: Rate limited
  rateLimited: {
    description: "API returns 429 after 3 calls",
    behavior: "Succeed for first 3, then 429 errors",
    delay: 1200,
    maxSuccessfulCalls: 3
  },

  // Scenario 6: Slow API
  slowApi: {
    description: "API responds slowly (near timeout)",
    behavior: "5-second delay per call",
    delay: 5000,
    errorRate: 0
  },

  // Scenario 7: Variable response sizes
  variableResponses: {
    description: "Different story counts per epic",
    behavior: "Random 3-15 stories per call",
    delay: 1200,
    storyCountRange: [3, 15]
  }
};
```

### 3.2 Database Mock Scenarios

```typescript
export const dbMockScenarios = {
  // Scenario: Concurrent access
  concurrentAccess: {
    description: "Simulate race condition on run creation",
    behavior: "Two processes attempt to create run simultaneously"
  },

  // Scenario: Transaction timeout
  transactionTimeout: {
    description: "Database transaction times out during save",
    behavior: "Timeout after 30s on INSERT"
  },

  // Scenario: Disk full
  diskFull: {
    description: "Database storage limit reached",
    behavior: "Throw error on INSERT after 100 stories"
  }
};
```

---

## 4. Performance Benchmarks

### 4.1 Duration Benchmarks

| Scenario | Epic Count | Mode | Pacing | Max Duration | Target Duration |
|----------|-----------|------|--------|--------------|-----------------|
| Small project | 3 | Standard | Fast | 30s | 20s |
| Medium project | 10 | Standard | Fast | 2min | 1min |
| Medium project | 10 | Standard | Safe | 5min | 3min |
| Large project | 25 | Standard | Safe | 10min | 7min |
| Extra large | 50 | Compact | Safe | 15min | 12min |

### 4.2 Throughput Benchmarks

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Epics per minute (Fast) | 6-8 | 4 |
| Epics per minute (Safe) | 3-4 | 2 |
| Stories per epic (Compact) | 5-8 | 3-10 |
| Stories per epic (Standard) | 8-12 | 6-15 |
| Stories per epic (Detailed) | 12-15 | 10-18 |

### 4.3 Resource Benchmarks

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Memory per epic | < 50MB | 100MB |
| Database connections | 1-2 | 5 |
| API calls per epic | 1 | 3 (with retries) |
| Token usage per epic (avg) | ~2000 | 4096 |

---

## 5. UI State Verification Checklist

### 5.1 Pre-Run States

- [ ] "Generate ALL Stories" button visible when epics exist
- [ ] Button disabled when no epics (with tooltip)
- [ ] Mode selector (Compact/Standard/Detailed) visible
- [ ] Pacing selector (Fast/Safe) visible if implemented
- [ ] Skip/Replace mode selector visible when stories exist
- [ ] Confirmation dialog appears for Replace mode

### 5.2 During Run States

- [ ] Button shows loading spinner
- [ ] Button disabled (no double-click)
- [ ] Progress bar visible
- [ ] Progress percentage updates in real-time
- [ ] Current epic highlighted in list
- [ ] Completed epics show green checkmark
- [ ] Failed epics show red X
- [ ] Cancel button visible and enabled
- [ ] Navigation blocked or warned

### 5.3 Post-Run States (Success)

- [ ] Success toast appears
- [ ] Toast includes epic count and story count
- [ ] Button re-enabled
- [ ] All epics show completed state
- [ ] Stories visible for each epic
- [ ] Run history updated
- [ ] Page can navigate freely

### 5.4 Post-Run States (Partial Success)

- [ ] Partial success toast appears
- [ ] Toast shows completed vs failed counts
- [ ] Failed epics highlighted in red
- [ ] "Retry Failed" button visible
- [ ] Error details expandable per epic
- [ ] Completed epics' stories preserved

### 5.5 Post-Run States (Cancelled)

- [ ] Cancellation toast appears
- [ ] Completed epics show success state
- [ ] Pending epics show neutral state (not failed)
- [ ] "Resume" or "Retry Remaining" button visible
- [ ] Cancel button hidden

### 5.6 Post-Run States (Total Failure)

- [ ] Error toast/banner appears
- [ ] Error message is clear and actionable
- [ ] All epics show failed state
- [ ] "Retry All" button visible
- [ ] Troubleshooting hints provided

### 5.7 Error Display States

- [ ] API errors show message
- [ ] Rate limit errors show retry guidance
- [ ] Timeout errors show duration
- [ ] Network errors distinguished from API errors
- [ ] Stack traces hidden from users (logged only)

---

## 6. Test Data Setup Scripts

### 6.1 Setup Script: Create Test Project with N Epics

```typescript
// scripts/setup-test-project.ts

import { db } from "@/lib/db";

export async function createTestProject(
  epicCount: number,
  storiesPerEpic: number = 0
): Promise<string> {
  const project = await db.project.create({
    data: {
      name: `Test Project - ${epicCount} Epics`,
      description: "Automated test project",
    },
  });

  for (let i = 0; i < epicCount; i++) {
    const epic = await db.epic.create({
      data: {
        projectId: project.id,
        code: `E${i + 1}`,
        title: `Test Epic ${i + 1}`,
        description: `Description for epic ${i + 1}`,
        theme: "Testing",
        businessValue: "Test business value",
        priority: i + 1,
      },
    });

    // Optionally create existing stories
    for (let j = 0; j < storiesPerEpic; j++) {
      await db.story.create({
        data: {
          epicId: epic.id,
          code: `S${j + 1}`,
          title: `Pre-existing Story ${j + 1}`,
          userStory: `As a user, I want test story ${j + 1}`,
          persona: "Test User",
          priority: "Medium",
          effort: "M",
        },
      });
    }
  }

  return project.id;
}
```

### 6.2 Cleanup Script

```typescript
// scripts/cleanup-test-data.ts

import { db } from "@/lib/db";

export async function cleanupTestProjects(): Promise<void> {
  await db.project.deleteMany({
    where: {
      name: { startsWith: "Test Project -" },
    },
  });
}
```

---

## 7. Suggested Test Implementation Order

### Phase 1: Critical Path (Week 1)
1. TC-HP-001: Basic happy path
2. TC-CR-001: Concurrent run prevention
3. TC-MC-001: Mid-run cancellation

### Phase 2: Edge Cases (Week 2)
1. TC-ZE-001, TC-ZE-002: Zero epics
2. TC-ES-001, TC-ER-001: Skip/Replace modes
3. TC-SF-001: Single epic failure
4. TC-RB-001: Retry behavior

### Phase 3: Scale & Performance (Week 3)
1. TC-ME-001: Many epics (25)
2. TC-PF-001, TC-PF-002: Duration benchmarks
3. TC-MM-001: Mock mode

### Phase 4: UI Polish (Week 4)
1. TC-UI-001 through TC-UI-005
2. Integration tests with full UI

---

## 8. Automation Recommendations

### 8.1 Unit Tests (Vitest)
- Provider mock behavior
- Run status transitions
- Story generation logic
- Cancellation token handling

### 8.2 Integration Tests (Playwright)
- Full user flow from button click to completion
- Progress polling verification
- Error display validation
- Retry flow end-to-end

### 8.3 API Tests (Supertest/REST)
- `/api/runs/[id]` progress endpoint
- `/api/projects/[id]/active-run` detection
- Rate limiting behavior
- Error response formats

### 8.4 Load Tests (k6/Artillery)
- Concurrent user simulation
- Database connection pooling
- API rate limit handling

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| API rate limiting | High | High | Pacing options, backoff |
| Database deadlock | Low | High | Optimistic locking |
| Memory exhaustion | Medium | High | Streaming, cleanup |
| User abandonment | Medium | Low | Clear progress indication |
| Data corruption | Low | Critical | Transactions, validation |
| Timeout on large projects | High | Medium | Configurable timeouts |

---

## 10. Sign-off Criteria

### Must Pass (Blocker)
- [ ] TC-HP-001: Happy path with 3 epics
- [ ] TC-CR-001: No concurrent runs
- [ ] TC-MC-001: Cancellation works
- [ ] TC-SF-001: Single failure doesn't stop run

### Should Pass (High Priority)
- [ ] TC-ME-001: 25 epics complete
- [ ] TC-ES-001: Skip mode works
- [ ] TC-ER-001: Replace mode works
- [ ] TC-RB-001: Retry creates new run

### Nice to Have
- [ ] TC-UI-003: Auto-scroll during run
- [ ] TC-PF-003: Memory stable

---

*Document Version: 1.0*
*Created: 2025-01-07*
*Feature Status: Planned (Not Yet Implemented)*
