# Progress Visualization Redesign

## Executive Summary

This document provides a comprehensive UX audit of the current progress visualization system and proposes a redesign that ensures progress is always visible, persists across navigation, and provides granular real-time updates.

---

## Part 1: Current UX Audit

### 1.1 Action Trigger Flow

**Batch Story Generation ("Generate All Stories")**

| Step | Component | Location |
|------|-----------|----------|
| 1. Entry Point | `GenerateAllStoriesButton` | `components/batch-stories/generate-all-stories-button.tsx` |
| 2. Configuration | `BatchStoryConfigDialog` | `components/batch-stories/batch-story-config-dialog.tsx` |
| 3. Progress Display | `BatchStoryRunProgress` | `components/batch-stories/batch-story-run-progress.tsx` |
| 4. Polling Hook | `useBatchStoryProgress` | `hooks/use-batch-story-progress.ts` |

**Document Analysis ("Analyze Project")**

| Step | Component | Location |
|------|-----------|----------|
| 1. Entry Point | `AnalyzePanel` | `components/analysis/analyze-panel.tsx` |
| 2. Progress Display | `RunProgressPanel` | `components/analysis/run-progress-panel.tsx` |
| 3. Polling Hook | `useRunProgress` | `hooks/use-run-progress.ts` |

### 1.2 Current Modal/Panel Behavior

**Problem: Progress shown inline, not persistent**

```
Current Flow:
1. User clicks "Generate All Stories" button
2. BatchStoryConfigDialog opens (3-step wizard: Scope -> Settings -> Confirm)
3. User clicks "Start Generation"
4. Dialog closes
5. BatchStoryRunProgress Card appears INLINE in EpicsSection
6. Progress is polled via useBatchStoryProgress hook (1s interval)
7. On completion, toast notification shown

Issues:
- Progress panel is embedded in project page content
- Navigating away (e.g., to another section/page) loses visual progress
- Returning to page requires re-checking active run via useActiveBatchStoryRun
- No persistent "Active Run" indicator across the application
- Modal spinner during initial load with no granular feedback
```

### 1.3 Progress Update Mechanism

**Polling Strategy (Current)**

```typescript
// hooks/use-batch-story-progress.ts
const { pollInterval = 1000 } = options;

// Fetches from /api/runs/[id]/batch-story
const fetchProgress = async (id: string): Promise<BatchStoryProgress | null> => {
  const response = await fetch(`/api/runs/${id}/batch-story`, {
    cache: "no-store",
  });
  return await response.json();
};
```

**Data Shape Returned**

```typescript
interface BatchStoryProgress {
  runId: string;
  status: RunStatus;          // QUEUED | RUNNING | SUCCEEDED | PARTIAL | FAILED | CANCELLED
  phase: RunPhase;            // INITIALIZING | QUEUEING_EPICS | GENERATING_STORIES | FINALIZING

  // Counters
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
  skippedEpics: number;
  totalStoriesCreated: number;

  // Current processing
  currentEpicId?: string;
  currentEpicTitle?: string;

  // Per-epic details
  epics: RunEpicProgress[];   // Array with status per epic

  // Timing
  elapsedMs?: number;
  estimatedRemainingMs?: number;
}
```

### 1.4 State Loss on Refresh/Navigation

**Current Behavior:**

1. **On page refresh**: Progress panel disappears, page shows loading state
2. **Recovery mechanism**: `useActiveBatchStoryRun(projectId)` hook checks `/api/projects/[id]/active-batch-story-run`
3. **Rehydration**: If active run found, `setActiveRunId(runId)` triggers progress panel display

**Gap**: Progress is project-scoped. Navigating to another project loses context entirely.

### 1.5 Component Analysis Summary

| Component | Purpose | Issues |
|-----------|---------|--------|
| `BatchStoryRunProgress` | Full progress card with epic queue | Embedded inline, no persistence |
| `RunProgressPanel` | Document analysis progress | Same inline embedding issue |
| `EpicsSection` | Wrapper that conditionally shows progress | State lost on unmount |
| `useActiveBatchStoryRun` | Checks for existing run | Only works for one project |

---

## Part 2: Proposed UX Redesign

### 2.1 Design Principles

1. **Progress is always visible**: A persistent indicator shows active runs globally
2. **Navigation-safe**: User can browse anywhere without losing progress context
3. **Rehydration-first**: UI rebuilds from server state, not client state
4. **Granular updates**: Per-epic status with live counters and estimated time

### 2.2 New User Journey

```
KICKOFF FLOW
============
1. User navigates to Project -> Epics section
2. User clicks "Generate All Stories" button
3. BatchStoryConfigDialog opens (existing wizard works well)
4. User completes 3-step configuration
5. User clicks "Start Generation"
6. CHANGE: Dialog closes, user is redirected to /runs/[runId] page
7. NEW: Global "Active Run" banner appears in header/sidebar

PROGRESS VIEW (New dedicated page)
==================================
Route: /runs/[runId]

Layout:
+--------------------------------------------------+
| <- Back to Project: [Project Name]               |
|                                                   |
| [Generating Stories]              [RUNNING] 2m30s|
|                                                   |
| +-----------------------------------------------+ |
| | Overall Progress                              | |
| | [====================--------] 65%            | |
| | 13 of 20 epics processed | 156 stories        | |
| | ~4 minutes remaining                          | |
| +-----------------------------------------------+ |
|                                                   |
| +-----------------------------------------------+ |
| | Epic Queue                                    | |
| +-----------------------------------------------+ |
| | [x] EPIC-001: User Authentication      12 st  | |
| | [x] EPIC-002: Dashboard Layout         8 st   | |
| | [*] EPIC-003: Report Generation        (6/10) | |
| |     "Generating story 6 of ~10..."            | |
| | [ ] EPIC-004: Notifications            pending | |
| | [ ] EPIC-005: Settings                 pending | |
| +-----------------------------------------------+ |
|                                                   |
| [Cancel Run]                                      |
+--------------------------------------------------+

Legend: [x] completed, [*] in progress, [ ] pending

PERSISTENCE ACROSS NAVIGATION
=============================
1. User navigates to /projects (project list)
2. NEW: Global ActiveRunBanner in header shows:
   "Generating stories for [Project Name] - 65% complete"
3. Clicking banner returns to /runs/[runId]
4. Alternatively: Project card shows "Active run" badge

MULTIPLE TABS
=============
1. All tabs poll the same /api/runs/[id] endpoint
2. Server state is source of truth
3. All tabs show consistent progress
```

### 2.3 Component Hierarchy

```
NEW COMPONENTS
==============

src/
  components/
    runs/
      run-progress-page.tsx      # Full-page progress view
      epic-progress-list.tsx     # Epic queue with statuses
      progress-summary-card.tsx  # Overall progress stats
      active-run-banner.tsx      # Global notification bar

    layout/
      header.tsx                 # Updated to include ActiveRunBanner slot

UPDATED COMPONENTS
==================
  components/
    batch-stories/
      batch-story-config-dialog.tsx  # Add redirect to /runs/[id] on start

    projects/
      project-card.tsx               # Add "Active Run" badge

    epics/
      epics-section.tsx              # Remove inline progress, add link to run page
```

### 2.4 Component Specifications

#### 2.4.1 `RunProgressPage` (New)

**Location**: `components/runs/run-progress-page.tsx`

**Purpose**: Full-page dedicated progress visualization

**Props**:
```typescript
interface RunProgressPageProps {
  runId: string;
  projectId: string;
  projectName: string;
}
```

**Features**:
- Server component wrapper with client island for polling
- Breadcrumb navigation back to project
- Real-time polling (1s interval)
- Keyboard accessible (focus management)
- Screen reader announcements for status changes

**States**:
| State | Visual |
|-------|--------|
| Loading | Skeleton with pulsing animation |
| Running | Progress bar, epic queue, cancel button |
| Completed | Success banner, "View Stories" CTA |
| Failed | Error message, "Retry Failed" button |
| Cancelled | Neutral banner, "Back to Project" |

#### 2.4.2 `EpicProgressList` (New)

**Location**: `components/runs/epic-progress-list.tsx`

**Purpose**: Displays epic queue with per-epic status

**Props**:
```typescript
interface EpicProgressListProps {
  epics: RunEpicProgress[];
  currentEpicId?: string;
}
```

**Epic Status Icons**:
| Status | Icon | Color |
|--------|------|-------|
| PENDING | Circle | muted |
| GENERATING | Sparkles (animated) | primary |
| SAVING | Save (animated) | primary |
| COMPLETED | CheckCircle2 | success |
| FAILED | XCircle | destructive |
| SKIPPED | SkipForward | warning |

**Accessibility**:
- `role="list"` on container
- `role="listitem"` on each epic
- `aria-current="true"` on active epic
- Live region for status changes

#### 2.4.3 `ProgressSummaryCard` (New)

**Location**: `components/runs/progress-summary-card.tsx`

**Purpose**: Overall progress stats at a glance

**Props**:
```typescript
interface ProgressSummaryCardProps {
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
  skippedEpics: number;
  totalStoriesCreated: number;
  elapsedMs?: number;
  estimatedRemainingMs?: number;
  status: RunStatus;
}
```

**Layout**:
```
+------------------------------------------------+
| Overall Progress                               |
| [=========================-----] 75%           |
|                                                |
| 15/20 epics | 189 stories | ~3 min remaining  |
+------------------------------------------------+
```

#### 2.4.4 `ActiveRunBanner` (New)

**Location**: `components/runs/active-run-banner.tsx`

**Purpose**: Global notification for active runs

**Props**:
```typescript
interface ActiveRunBannerProps {
  runId: string;
  projectId: string;
  projectName: string;
  runType: RunType;
  progressPercent: number;
  status: RunStatus;
}
```

**Placement**: Inserted in `components/layout/header.tsx` or as sticky bar

**Behavior**:
- Only visible when there's an active run
- Polls for run status (can use longer interval, e.g., 3s)
- Clicking navigates to `/runs/[runId]`
- Dismissible (hides but run continues)

**Visual**:
```
+------------------------------------------------------------------+
| [Sparkles] Generating stories for "My Project" - 65% [View] [x]  |
+------------------------------------------------------------------+
```

### 2.5 Polling Strategy Specification

**Current**: 1 second interval, fetch on every tick

**Proposed**: Adaptive polling with backoff

```typescript
// hooks/use-adaptive-polling.ts

interface AdaptivePollingConfig {
  initialInterval: number;    // 1000ms
  maxInterval: number;        // 5000ms
  backoffMultiplier: number;  // 1.5
  resetOnActivity: boolean;   // true
}

// Behavior:
// 1. Start with 1s interval
// 2. If no status change for 3 consecutive polls, increase interval
// 3. If status changes (e.g., epic completed), reset to 1s
// 4. Cap at 5s max interval
// 5. Always return to 1s when run completes
```

**API Endpoints**:

| Endpoint | Purpose | Polling |
|----------|---------|---------|
| `/api/runs/[id]/batch-story` | Full progress with epics | 1-5s adaptive |
| `/api/projects/[id]/active-batch-story-run` | Check if run exists | On page load only |
| `/api/runs/[id]` | Basic run status | For global banner (3s) |

### 2.6 State Management Approach

**Server State (Source of Truth)**:
- Run status stored in database
- All progress derived from DB queries
- Mutations trigger immediate refetch

**Client State (UI Only)**:
- `isPolling`: boolean
- `lastFetchTime`: timestamp
- `expandedEpics`: Set<string> (UI preference)
- `isCancelling`: boolean (optimistic UI)

**No Client-Side Persistence**:
- Do not use localStorage/sessionStorage for run state
- Always rehydrate from server on mount
- This ensures multi-tab consistency

### 2.7 Wireframes (ASCII)

#### Main Progress Page

```
+------------------------------------------------------------------+
| <- Back to "Customer Portal" project                              |
+------------------------------------------------------------------+
|                                                                   |
|  [Sparkles Icon]                                                  |
|  Generating User Stories                      [RUNNING] [2m 45s]  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | Progress                                                    |  |
|  | [================================---------] 78%             |  |
|  |                                                             |  |
|  | 7 of 9 epics | 2 skipped | 0 failed | 84 stories created   |  |
|  | Estimated: ~45 seconds remaining                            |  |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | Epic Queue                                     [Collapse All] |
|  +-------------------------------------------------------------+  |
|  | [check] EPIC-001: User Authentication              12 stories |
|  |         Completed in 32s                                     |
|  +-------------------------------------------------------------+  |
|  | [check] EPIC-002: Dashboard Overview               8 stories  |
|  |         Completed in 28s                                     |
|  +-------------------------------------------------------------+  |
|  | [skip] EPIC-003: Legacy Reports                   (skipped)   |
|  |        Already has 15 stories                                |
|  +-------------------------------------------------------------+  |
|  | [spin] EPIC-004: Notification System              6 of ~10    |
|  |        Generating story for "Admin configures alerts..."    |
|  +-------------------------------------------------------------+  |
|  | [circle] EPIC-005: Settings & Preferences          pending    |
|  +-------------------------------------------------------------+  |
|  | [circle] EPIC-006: Audit Logging                   pending    |
|  +-------------------------------------------------------------+  |
|                                                                   |
|  [Cancel Generation]                                              |
|                                                                   |
+------------------------------------------------------------------+
```

#### Global Banner (Header)

```
+------------------------------------------------------------------+
|  [Logo] Requirements Foundry                    [Projects] [Help] |
+------------------------------------------------------------------+
| [sparkle] Generating stories: "Customer Portal" 78% [View] [x]   |
+------------------------------------------------------------------+
```

#### Project Card with Active Run Badge

```
+-------------------------------+
| Customer Portal               |
| 24 cards | 9 epics | 84 st    |
|                               |
| [badge: Active Run - 78%]     |
|                               |
| Updated 2 minutes ago         |
+-------------------------------+
```

### 2.8 Accessibility Requirements

**Keyboard Navigation**:
- Tab through interactive elements
- Enter/Space to expand/collapse epics
- Arrow keys to navigate epic list
- Escape to close banner

**Screen Reader Support**:
- Live region announces: "Epic 4 completed. 84 stories created."
- Progress bar has `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Status changes announced: "Generation complete. 156 stories created."

**Motion**:
- Respect `prefers-reduced-motion`
- Pulsing indicators pause when motion disabled

### 2.9 Error Handling

**Network Failure**:
- Show toast: "Connection lost. Retrying..."
- Continue polling with exponential backoff
- After 3 failures, show persistent error with manual retry

**Run Failure**:
- Display error message from API
- Show "Retry Failed Epics" button
- Offer "View Partial Results" if some succeeded

**Timeout on Vercel**:
- Already handled via continuation pattern (see recent commits)
- Progress page should show current state regardless

---

## Part 3: Implementation Plan

### Phase 1: Core Infrastructure (Priority)

1. Create `/app/runs/[id]/progress/page.tsx` - dedicated progress page
2. Create `EpicProgressList` component
3. Create `ProgressSummaryCard` component
4. Update `BatchStoryConfigDialog` to redirect to progress page on start

### Phase 2: Global Awareness

1. Create `ActiveRunBanner` component
2. Create `useGlobalActiveRun` hook (checks across projects)
3. Integrate banner into `Header` or layout
4. Add "Active Run" badge to `ProjectCard`

### Phase 3: Polish & Accessibility

1. Add live announcer for screen readers
2. Implement adaptive polling
3. Add keyboard navigation
4. Add motion-reduced variants

### Phase 4: Testing

1. E2E tests for full flow
2. Test multi-tab synchronization
3. Test navigation during active run
4. Test refresh recovery

---

## Part 4: Migration Notes

**Backward Compatibility**:
- Keep existing `BatchStoryRunProgress` for now (can deprecate later)
- Existing API endpoints remain unchanged
- Polling hooks can be shared between old and new views

**Rollout Strategy**:
1. Ship progress page first (opt-in via config dialog redirect)
2. Add global banner (visible to all)
3. Deprecate inline progress panels
4. Remove old components in future release

---

## Appendix: File Reference

### Existing Components (Audit)

| File | Purpose |
|------|---------|
| `hooks/use-batch-story-progress.ts` | Polling hook for batch story runs |
| `hooks/use-run-progress.ts` | Polling hook for analysis runs |
| `components/batch-stories/batch-story-run-progress.tsx` | Inline progress card |
| `components/batch-stories/batch-story-config-dialog.tsx` | 3-step wizard |
| `components/batch-stories/generate-all-stories-button.tsx` | Entry point button |
| `components/analysis/run-progress-panel.tsx` | Analysis progress card |
| `components/epics/epics-section.tsx` | Wrapper with inline progress |
| `app/runs/[id]/page.tsx` | Basic run details page (static) |

### New Components (Proposal)

| File | Purpose |
|------|---------|
| `app/runs/[id]/progress/page.tsx` | Dedicated progress page route |
| `components/runs/run-progress-page.tsx` | Full-page progress component |
| `components/runs/epic-progress-list.tsx` | Epic queue visualization |
| `components/runs/progress-summary-card.tsx` | Overall progress stats |
| `components/runs/active-run-banner.tsx` | Global notification bar |
| `hooks/use-global-active-run.ts` | Cross-project run detection |
| `hooks/use-adaptive-polling.ts` | Smart polling with backoff |
