# Generate ALL Stories - Feature Design Document

> **Status**: Design Complete | Ready for Implementation Review
> **Version**: 1.0
> **Date**: 2025-01-07

---

## Executive Summary

This document specifies a **batch story generation** feature that processes all Epics in a project sequentially, with full progress visibility, rate limiting, and per-epic error isolation.

### Key Design Principles
1. **Truthful Progress** - Real counters, no fake percentages
2. **Epic-Level Isolation** - One failure doesn't crash the run
3. **Additive Design** - Extends existing per-epic flow, doesn't replace it
4. **Serverless-First** - Designed for Vercel with 300s timeout awareness
5. **Mock Mode Support** - Works without API key for local development

---

## 1. Proposed Schema Changes (Prisma Diff Style)

### New Model: RunEpic

```prisma
// ============================================
// NEW: RunEpic Junction Table
// Links Runs to Epics for batch story generation
// ============================================

model RunEpic {
  id        String   @id @default(cuid())
  runId     String
  run       Run      @relation(fields: [runId], references: [id], onDelete: Cascade)
  epicId    String
  epic      Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)

  // Status tracking
  status    String   @default("PENDING") // PENDING | GENERATING | SAVING | COMPLETED | FAILED | SKIPPED

  // Ordering for sequential processing
  order     Int      @default(0)

  // Timing
  startedAt    DateTime?
  completedAt  DateTime?
  durationMs   Int?

  // Token tracking (for cost estimation)
  tokensUsed   Int?

  // Results
  storiesCreated   Int      @default(0)
  storiesDeleted   Int      @default(0)  // When mode=replace
  errorMsg         String?
  retryCount       Int      @default(0)

  // Configuration snapshot (for audit/retry)
  mode             String?  // compact | standard | detailed
  personaSet       String?  // lightweight | core | full

  createdAt        DateTime @default(now())

  @@unique([runId, epicId])
  @@index([runId])
  @@index([epicId])
  @@index([runId, status])
}
```

### Run Model Extensions

```prisma
model Run {
  // ... existing fields unchanged ...

  // NEW: Additional counters for batch operations
  skippedItems     Int      @default(0)  // Epics skipped (had stories + skip mode)

  // NEW: Current processing pointer
  currentItemId    String?              // Currently processing Epic ID
  currentItemIndex Int?                 // 1-based index for display

  // NEW: Relation to RunEpic
  runEpics         RunEpic[]
}
```

### Epic Model Extension

```prisma
model Epic {
  // ... existing fields unchanged ...

  // NEW: Relation to RunEpic
  runEpics RunEpic[]
}
```

### Migration Notes

```sql
-- Add new columns to Run table
ALTER TABLE "Run" ADD COLUMN "skippedItems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Run" ADD COLUMN "currentItemId" TEXT;
ALTER TABLE "Run" ADD COLUMN "currentItemIndex" INTEGER;

-- Create RunEpic table
CREATE TABLE "RunEpic" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "epicId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "order" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "tokensUsed" INTEGER,
  "storiesCreated" INTEGER NOT NULL DEFAULT 0,
  "storiesDeleted" INTEGER NOT NULL DEFAULT 0,
  "errorMsg" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "mode" TEXT,
  "personaSet" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RunEpic_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
CREATE UNIQUE INDEX "RunEpic_runId_epicId_key" ON "RunEpic"("runId", "epicId");

-- Performance indexes
CREATE INDEX "RunEpic_runId_idx" ON "RunEpic"("runId");
CREATE INDEX "RunEpic_epicId_idx" ON "RunEpic"("epicId");
CREATE INDEX "RunEpic_runId_status_idx" ON "RunEpic"("runId", "status");

-- Foreign keys
ALTER TABLE "RunEpic" ADD CONSTRAINT "RunEpic_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE;
ALTER TABLE "RunEpic" ADD CONSTRAINT "RunEpic_epicId_fkey"
  FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE CASCADE;
```

---

## 2. Run State Machine + Event Model

### State Diagram

```
                              ┌─────────────────────────────────────────────────────┐
                              │                                                     │
    ┌──────────┐   create     │   ┌───────────┐   start    ┌───────────────────┐   │
    │  (init)  │─────────────►│──►│  QUEUED   │──────────►│    RUNNING        │   │
    └──────────┘              │   └───────────┘            │                   │   │
                              │         │                  │  ┌─────────────┐  │   │
                              │         │ cancel           │  │ QUEUEING_   │  │   │
                              │         ▼                  │  │ EPICS       │──┼───┤
                              │   ┌───────────┐            │  └─────────────┘  │   │
                              │   │ CANCELLED │            │         │         │   │
                              │   └───────────┘            │         ▼         │   │
                              │         ▲                  │  ┌─────────────┐  │   │
                              │         │ cancel           │  │ GENERATING_ │  │   │
                              │         │                  │  │ STORIES     │──┼───┤
                              │         │                  │  └─────────────┘  │   │
                              │   ┌─────┴─────┐            │         │         │   │
                              │   │           │            └─────────┼─────────┘   │
                              │   │           │                      │             │
                              │   │           │     all done         ▼             │
                              │   │           │◄──────────────┬─────────────┐      │
                              │   │           │               │  COMPLETED  │      │
                              │   │           │               └─────────────┘      │
                              │   │           │                      │             │
                              │   │           │     some failed      │             │
                              │   │           │◄─────────────────────┘             │
                              │   │           │               │                    │
                              │   │           │               ▼                    │
                              │   │           │        ┌─────────────┐             │
                              │   │           │        │   PARTIAL   │             │
                              │   │           │        └─────────────┘             │
                              │   │           │               │                    │
                              │   │           │     all failed│                    │
                              │   │           │◄──────────────┘                    │
                              │   │           │               │                    │
                              │   │           │               ▼                    │
                              │   │           │        ┌─────────────┐             │
                              │   └───────────┘        │   FAILED    │             │
                              │                        └─────────────┘             │
                              │                                                     │
                              └─────────────────────────────────────────────────────┘
```

### State Definitions

| State | Description | Exit Conditions |
|-------|-------------|-----------------|
| **QUEUED** | Run created, waiting to start | → RUNNING (start), → CANCELLED (cancel) |
| **RUNNING** | Actively processing epics | → COMPLETED, → PARTIAL, → FAILED, → CANCELLED |
| **COMPLETED** | All epics succeeded | Terminal |
| **PARTIAL** | Some epics failed, some succeeded | Terminal |
| **FAILED** | All epics failed or critical error | Terminal |
| **CANCELLED** | User cancelled mid-run | Terminal |

### Phase Definitions (within RUNNING)

| Phase | Description | phaseDetail Example |
|-------|-------------|---------------------|
| **INITIALIZING** | Setting up run context | "Validating project..." |
| **QUEUEING_EPICS** | Creating RunEpic records | "Found 12 epics to process" |
| **GENERATING_STORIES** | Processing epics sequentially | "Processing Epic 3 of 12: User Authentication" |
| **FINALIZING** | Aggregating results | "Calculating final statistics..." |

### RunEpic Status Flow

```
PENDING → GENERATING → SAVING → COMPLETED
    │         │          │
    │         │          └──► FAILED (save error)
    │         └──────────────► FAILED (generation error)
    │
    └────────────────────────► SKIPPED (skip mode + has stories)
```

### Counter Update Rules

| Event | Update |
|-------|--------|
| Run created | `totalItems = epicCount` |
| Epic starts | `currentItemId = epicId`, `currentItemIndex = order + 1` |
| Epic completes | `completedItems++`, `totalCards += storiesCreated` |
| Epic fails | `failedItems++` |
| Epic skipped | `skippedItems++` |
| All done | `currentItemId = null`, `currentItemIndex = null` |

### Event Model

```typescript
type BatchStoryEvent =
  | { type: "RUN_CREATED"; runId: string; totalEpics: number }
  | { type: "EPIC_STARTED"; epicId: string; epicIndex: number; epicTitle: string }
  | { type: "EPIC_GENERATING"; epicId: string; detail: string }
  | { type: "EPIC_SAVING"; epicId: string; storyCount: number }
  | { type: "EPIC_COMPLETED"; epicId: string; storiesCreated: number; durationMs: number }
  | { type: "EPIC_FAILED"; epicId: string; error: string }
  | { type: "EPIC_SKIPPED"; epicId: string; reason: string }
  | { type: "RUN_COMPLETED"; totalStories: number; durationMs: number }
  | { type: "RUN_FAILED"; error: string }
  | { type: "RUN_CANCELLED"; completedEpics: number }
  | { type: "RATE_LIMITED"; retryAfterMs: number };
```

---

## 3. API / Server Action Contracts

### Primary Actions

#### `startGenerateAllStories`

```typescript
// Location: server/actions/batch-stories.ts

interface GenerateAllStoriesInput {
  projectId: string;
  options: {
    mode: "compact" | "standard" | "detailed";
    personaSet: "lightweight" | "core" | "full";
    existingStoriesBehavior: "replace" | "skip";
    epicIds?: string[];  // Optional: specific epics only (for retry)
    pacing: "safe" | "normal" | "fast";
  };
}

interface GenerateAllStoriesResult {
  success: boolean;
  runId?: string;
  error?: string;
  epicCount?: number;
}

export async function startGenerateAllStories(
  input: GenerateAllStoriesInput
): Promise<GenerateAllStoriesResult>;
```

**Validation Rules:**
- Project must exist
- No active GENERATE_ALL_STORIES run for project
- At least 1 epic exists (or specified epicIds exist)
- If epicIds provided, all must belong to project

**Side Effects:**
- Creates Run record with type=GENERATE_ALL_STORIES
- Creates RunEpic records for each epic
- Updates Epic.analysisStatus where applicable
- Executes run (awaited, not fire-and-forget)
- Calls revalidatePath on completion

---

#### `getBatchStoryProgress`

```typescript
// Location: server/actions/batch-stories.ts

interface BatchStoryProgress {
  runId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  phase: "INITIALIZING" | "QUEUEING_EPICS" | "GENERATING_STORIES" | "FINALIZING";
  phaseDetail?: string;

  // Counters
  totalEpics: number;
  completedEpics: number;
  failedEpics: number;
  skippedEpics: number;
  totalStoriesCreated: number;

  // Current processing
  currentEpicIndex?: number;  // 1-based
  currentEpicId?: string;
  currentEpicTitle?: string;

  // Epic details
  epics: Array<{
    epicId: string;
    epicTitle: string;
    status: "PENDING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED" | "SKIPPED";
    storiesCreated: number;
    durationMs?: number;
    error?: string;
  }>;

  // Timing
  startedAt?: Date;
  elapsedMs?: number;
  estimatedRemainingMs?: number;

  // Error
  error?: string;
}

export async function getBatchStoryProgress(
  runId: string
): Promise<BatchStoryProgress | null>;
```

---

#### `cancelBatchStoryRun`

```typescript
// Location: server/actions/batch-stories.ts

interface CancelResult {
  success: boolean;
  error?: string;
}

export async function cancelBatchStoryRun(
  runId: string
): Promise<CancelResult>;
```

**Behavior:**
- Sets cancellation flag in executor
- If run not actively processing, updates status directly
- Resets PENDING RunEpics (does not touch COMPLETED ones)

---

#### `retryFailedEpics`

```typescript
// Location: server/actions/batch-stories.ts

interface RetryResult {
  success: boolean;
  newRunId?: string;  // Creates NEW run, doesn't modify original
  error?: string;
  epicCount?: number;
}

export async function retryFailedEpics(
  originalRunId: string
): Promise<RetryResult>;
```

**Behavior:**
- Finds all FAILED RunEpics from original run
- Creates NEW run with only those epicIds
- Original run preserved for audit trail
- Inherits original run's configuration (mode, personaSet, pacing)

---

### Supporting Actions

#### `getActiveStoryRun`

```typescript
export async function getActiveStoryRun(
  projectId: string
): Promise<{ runId: string } | null>;
```

---

#### `getEpicsForBatchGeneration`

```typescript
interface EpicForBatch {
  id: string;
  title: string;
  storyCount: number;
  cardCount: number;
}

export async function getEpicsForBatchGeneration(
  projectId: string
): Promise<EpicForBatch[]>;
```

**Returns:** All epics for project with their current story counts (for skip mode decision)

---

### Rate Limiting Configuration

```typescript
// Location: lib/run-engine/rate-limiting.ts

export const PACING_CONFIG = {
  safe: {
    delayBetweenEpicsMs: 3000,
    maxRetries: 3,
    retryBackoffMs: [5000, 10000, 20000],
  },
  normal: {
    delayBetweenEpicsMs: 1000,
    maxRetries: 3,
    retryBackoffMs: [3000, 6000, 12000],
  },
  fast: {
    delayBetweenEpicsMs: 500,
    maxRetries: 2,
    retryBackoffMs: [2000, 4000],
  },
} as const;
```

---

## 4. UI Flow + Component List

### User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROJECT PAGE                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Epics Tab] [Cards Tab] [Stories Tab]                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │  📋 Epics (12)                        [Generate ALL Stories ▼]  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │                                                                 │   │
│  │  Epic 1: User Authentication               [3 stories] [Gen]   │   │
│  │  Epic 2: Dashboard                         [0 stories] [Gen]   │   │
│  │  Epic 3: Reporting                         [0 stories] [Gen]   │   │
│  │  ...                                                            │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Click "Generate ALL Stories"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BATCH STORY CONFIG DIALOG                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Generate Stories for All Epics                            [X]  │   │
│  │                                                                 │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │  Step 1 of 3: Scope                    ● ○ ○                   │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │                                                                 │   │
│  │  12 epics will be processed sequentially.                      │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────┐     │   │
│  │  │ ⚠️  3 epics already have stories:                     │     │   │
│  │  │    • User Authentication (3 stories)                  │     │   │
│  │  │    • Payment Processing (5 stories)                   │     │   │
│  │  │    • Notifications (2 stories)                        │     │   │
│  │  └───────────────────────────────────────────────────────┘     │   │
│  │                                                                 │   │
│  │  For epics with existing stories:                              │   │
│  │  ○ Replace existing stories (delete and regenerate)            │   │
│  │  ● Skip these epics (keep existing stories)                    │   │
│  │                                                                 │   │
│  │                                          [Cancel] [Next →]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Click "Next"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Generate Stories for All Epics                            [X]  │   │
│  │                                                                 │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │  Step 2 of 3: Settings                 ● ● ○                   │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │                                                                 │   │
│  │  Generation Mode                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ ○ Compact    - Quick overview, fewer details            │   │   │
│  │  │ ● Standard   - Balanced detail and coverage             │   │   │
│  │  │ ○ Detailed   - Comprehensive with edge cases            │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  Persona Coverage                                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ ○ Lightweight - 1 primary persona                       │   │   │
│  │  │ ● Core        - 3 key personas                          │   │   │
│  │  │ ○ Full        - All 5 personas                          │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  Processing Speed                                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ ● Safe   - 3s delay, best for large batches             │   │   │
│  │  │ ○ Normal - 1s delay, balanced                           │   │   │
│  │  │ ○ Fast   - Minimal delay, may hit rate limits           │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │                                      [← Back] [Next →]          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Click "Next"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Generate Stories for All Epics                            [X]  │   │
│  │                                                                 │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │  Step 3 of 3: Confirm                  ● ● ●                   │   │
│  │  ══════════════════════════════════════════════════════════    │   │
│  │                                                                 │   │
│  │  Ready to generate stories for 9 epics                         │   │
│  │  (3 epics will be skipped - already have stories)              │   │
│  │                                                                 │   │
│  │  ┌───────────────────────────────────────────────────────┐     │   │
│  │  │ Summary                                               │     │   │
│  │  │ ─────────────────────────────────────────────────────│     │   │
│  │  │ Epics to process:    9                               │     │   │
│  │  │ Epics to skip:       3                               │     │   │
│  │  │ Mode:                Standard                         │     │   │
│  │  │ Personas:            Core (3)                         │     │   │
│  │  │ Pacing:              Safe (3s between epics)          │     │   │
│  │  │ Est. time:           ~2-4 minutes                     │     │   │
│  │  └───────────────────────────────────────────────────────┘     │   │
│  │                                                                 │   │
│  │  ⚠️  This will use AI credits. Processing cannot be undone    │   │
│  │     for completed epics, but you can cancel mid-run.           │   │
│  │                                                                 │   │
│  │                              [← Back] [Generate Stories]        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Click "Generate Stories"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROJECT PAGE                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  BATCH STORY GENERATION                          │   │
│  │                                                                 │   │
│  │  ═══════════════════════════════════════════════════════════   │   │
│  │  Processing Epic 3 of 9: Dashboard Analytics                    │   │
│  │  ═══════════════════════════════════════════════════════════   │   │
│  │                                                                 │   │
│  │  Overall Progress                                               │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  2 of 9 complete              │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ ✓ Epic 1: User Registration        4 stories   1.2s    │   │   │
│  │  │ ✓ Epic 2: Login Flow               3 stories   0.9s    │   │   │
│  │  │ ◉ Epic 3: Dashboard Analytics      Generating...        │   │   │
│  │  │ ○ Epic 4: Report Builder           Pending              │   │   │
│  │  │ ○ Epic 5: Export Functions         Pending              │   │   │
│  │  │ ○ Epic 6: Admin Panel              Pending              │   │   │
│  │  │ ○ Epic 7: User Settings            Pending              │   │   │
│  │  │ ○ Epic 8: Notifications            Pending              │   │   │
│  │  │ ○ Epic 9: API Integration          Pending              │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  Elapsed: 2m 15s  •  Est. remaining: ~3-5 minutes              │   │
│  │  Total stories created: 7                                       │   │
│  │                                                                 │   │
│  │                                              [Cancel Run]       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
ProjectPage
├── BatchStorySection (only visible when run active or recent)
│   └── BatchStoryRunProgress
│       ├── BatchRunHeader
│       ├── OverallProgressBar
│       ├── EpicQueueList
│       │   └── EpicQueueItem[] (virtualized for many epics)
│       ├── BatchRunStats
│       └── BatchRunActions
│           ├── CancelButton
│           └── RetryButton (visible when PARTIAL/FAILED)
│
└── EpicsSection
    ├── EpicsSectionHeader
    │   └── GenerateAllStoriesButton (disabled when run active)
    │       └── BatchStoryConfigDialog (3-step wizard)
    │           ├── ScopeStep (step 1)
    │           ├── SettingsStep (step 2)
    │           └── ConfirmationStep (step 3)
    │
    └── EpicsList
        └── EpicCard[] (each has individual "Generate" button)
```

### Component Specifications

#### `GenerateAllStoriesButton`

```typescript
// Location: components/batch-stories/generate-all-stories-button.tsx

interface GenerateAllStoriesButtonProps {
  projectId: string;
  epicCount: number;
  disabled?: boolean;
  onRunStarted?: (runId: string) => void;
}

// States:
// - enabled: epicCount > 0, no active run
// - disabled: epicCount === 0 OR active run exists
// - loading: starting run
```

#### `BatchStoryConfigDialog`

```typescript
// Location: components/batch-stories/batch-story-config-dialog.tsx

interface BatchStoryConfigDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunStarted: (runId: string) => void;
}

interface BatchStoryConfig {
  mode: "compact" | "standard" | "detailed";
  personaSet: "lightweight" | "core" | "full";
  existingStoriesBehavior: "replace" | "skip";
  pacing: "safe" | "normal" | "fast";
}
```

#### `BatchStoryRunProgress`

```typescript
// Location: components/batch-stories/batch-story-run-progress.tsx

interface BatchStoryRunProgressProps {
  runId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}
```

#### `EpicQueueItem`

```typescript
// Location: components/batch-stories/epic-queue-item.tsx

interface EpicQueueItemProps {
  epic: {
    epicId: string;
    title: string;
    status: "PENDING" | "GENERATING" | "SAVING" | "COMPLETED" | "FAILED" | "SKIPPED";
    storiesCreated: number;
    durationMs?: number;
    error?: string;
  };
  index: number;
  isActive: boolean;
}

// Visual states:
// PENDING: ○ dim, "Pending"
// GENERATING: ◉ pulsing blue, "Generating..."
// SAVING: ◉ pulsing blue, "Saving 4 stories..."
// COMPLETED: ✓ green, "4 stories 1.2s"
// FAILED: ✗ red, error message
// SKIPPED: ⊘ gray, "Skipped (has stories)"
```

### Key Hook

```typescript
// Location: hooks/use-batch-story-progress.ts

interface UseBatchStoryProgressOptions {
  pollingIntervalMs?: number;  // default: 1000
  onComplete?: () => void;
  onError?: (error: string) => void;
}

function useBatchStoryProgress(
  initialRunId?: string | null,
  options?: UseBatchStoryProgressOptions
): {
  progress: BatchStoryProgress | null;
  isLoading: boolean;
  error: string | null;
  isPolling: boolean;
  isActive: boolean;
  isComplete: boolean;
  hasFailed: boolean;
  currentEpic: EpicProgress | null;
  startPolling: (runId: string) => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
};
```

---

## 5. Implementation Plan Checklist

### Phase 1: Schema & Types (Day 1)

- [ ] **1.1** Add `RunEpic` model to `prisma/schema.prisma`
- [ ] **1.2** Add Run model extensions (skippedItems, currentItemId, currentItemIndex)
- [ ] **1.3** Add Epic model relation to RunEpic
- [ ] **1.4** Generate and run migration: `npx prisma migrate dev --name add-run-epic`
- [ ] **1.5** Add type definitions to `lib/types.ts`:
  - `RunType.GENERATE_ALL_STORIES`
  - `RunPhase.QUEUEING_EPICS`, `GENERATING_STORIES`
  - `RunEpicStatus` enum
  - `ExistingStoriesBehavior` enum
  - `ProcessingPacing` enum with `PACING_CONFIG`
  - `GenerateAllStoriesInput` interface
  - `BatchStoryProgress` interface
  - `EpicProgress` interface

### Phase 2: Backend - Server Actions (Day 1-2)

- [ ] **2.1** Create `server/actions/batch-stories.ts`
- [ ] **2.2** Implement `startGenerateAllStories()`:
  - Validation (project, no active run, has epics)
  - Create Run with type=GENERATE_ALL_STORIES
  - Create RunEpic records with order
  - Call executor (awaited)
- [ ] **2.3** Implement `getBatchStoryProgress()`:
  - Query Run with RunEpics
  - Calculate timing estimates
  - Return structured progress
- [ ] **2.4** Implement `cancelBatchStoryRun()`:
  - Set cancellation flag
  - Handle active vs queued states
- [ ] **2.5** Implement `retryFailedEpics()`:
  - Find failed RunEpics
  - Create new run with subset
- [ ] **2.6** Implement `getActiveStoryRun()`
- [ ] **2.7** Implement `getEpicsForBatchGeneration()`

### Phase 3: Backend - Executor (Day 2-3)

- [ ] **3.1** Create `lib/run-engine/batch-story-executor.ts`
- [ ] **3.2** Implement epic loop with:
  - Sequential processing
  - Pacing delays
  - Per-epic error isolation
  - Cancellation check between epics
- [ ] **3.3** Integrate with existing `generateStories()` function (reuse, don't rewrite)
- [ ] **3.4** Implement skip mode logic (check story count, skip if > 0)
- [ ] **3.5** Implement replace mode logic (delete existing stories first)
- [ ] **3.6** Add rate limit detection and backoff
- [ ] **3.7** Update counters correctly (see Counter Update Rules)

### Phase 4: Frontend - Components (Day 3-4)

- [ ] **4.1** Create `components/batch-stories/` directory
- [ ] **4.2** Implement `GenerateAllStoriesButton`:
  - Disabled states
  - Loading state
  - Opens dialog
- [ ] **4.3** Implement `BatchStoryConfigDialog`:
  - 3-step wizard (Scope → Settings → Confirm)
  - Scope: existing stories handling
  - Settings: mode, personas, pacing
  - Confirm: summary with estimates
- [ ] **4.4** Implement `BatchStoryRunProgress`:
  - Header with current epic
  - Overall progress bar
  - Epic queue list
  - Stats (elapsed, stories created)
  - Cancel button
- [ ] **4.5** Implement `EpicQueueItem`:
  - Status icons and colors
  - Duration display
  - Error display

### Phase 5: Frontend - Integration (Day 4)

- [ ] **5.1** Create `hooks/use-batch-story-progress.ts`
- [ ] **5.2** Integrate `GenerateAllStoriesButton` into EpicsSection
- [ ] **5.3** Add `BatchStoryRunProgress` to ProjectPage (conditional)
- [ ] **5.4** Add active run detection on page load
- [ ] **5.5** Handle page refresh during active run
- [ ] **5.6** Add retry button for PARTIAL/FAILED runs

### Phase 6: Testing (Day 5)

- [ ] **6.1** Test happy path: 3 epics, all succeed
- [ ] **6.2** Test zero epics: button disabled
- [ ] **6.3** Test skip mode: existing stories preserved
- [ ] **6.4** Test replace mode: existing stories deleted
- [ ] **6.5** Test mock mode: works without API key
- [ ] **6.6** Test cancellation: mid-run cancel
- [ ] **6.7** Test single epic failure: run continues
- [ ] **6.8** Test retry: failed epics only
- [ ] **6.9** Test concurrent prevention: second run blocked
- [ ] **6.10** Test page refresh: progress restored
- [ ] **6.11** Test large batch: 25 epics with safe pacing
- [ ] **6.12** Verify no duplicate stories created

### Phase 7: Polish (Day 5)

- [ ] **7.1** Add loading skeletons
- [ ] **7.2** Add error toasts
- [ ] **7.3** Add success celebration (confetti optional)
- [ ] **7.4** Verify mobile responsiveness
- [ ] **7.5** Add keyboard navigation in dialog
- [ ] **7.6** Test with screen reader

---

## Appendix A: Guardrails & Defaults

### Epic Count Guardrails

| Epic Count | Behavior |
|------------|----------|
| 0 | Button disabled, "No epics to process" |
| 1-10 | Normal flow |
| 11-25 | Warning: "This may take several minutes" |
| 26-50 | Require acknowledgment checkbox |
| 51+ | Blocked: "Please use per-epic generation for large projects" |

### Default Configuration

| Setting | Default | Rationale |
|---------|---------|-----------|
| Mode | Standard | Balanced quality/speed |
| Personas | Core (3) | Sufficient coverage without overhead |
| Existing Stories | Skip | Non-destructive default |
| Pacing | Safe | Prevents rate limit issues |

---

## Appendix B: UI Copy Document

### Button & Trigger Copy

| Element | Copy |
|---------|------|
| Main CTA | "Generate ALL Stories" |
| Disabled tooltip (no epics) | "Add epics to generate stories" |
| Disabled tooltip (active run) | "Story generation in progress" |

### Dialog Copy

| Element | Copy |
|---------|------|
| Dialog title | "Generate Stories for All Epics" |
| Step 1 title | "Scope" |
| Step 2 title | "Settings" |
| Step 3 title | "Confirm" |

### Step 1 (Scope) Copy

| Element | Copy |
|---------|------|
| Intro (no existing) | "{n} epics will be processed sequentially." |
| Intro (with existing) | "{n} epics will be processed. {m} already have stories." |
| Radio: Replace | "Replace existing stories (delete and regenerate)" |
| Radio: Skip | "Skip these epics (keep existing stories)" |
| Replace warning | "⚠️ Existing stories will be permanently deleted" |

### Step 2 (Settings) Copy

| Element | Copy |
|---------|------|
| Mode label | "Generation Mode" |
| Mode: Compact | "Quick overview, fewer details" |
| Mode: Standard | "Balanced detail and coverage" |
| Mode: Detailed | "Comprehensive with edge cases" |
| Persona label | "Persona Coverage" |
| Persona: Lightweight | "1 primary persona" |
| Persona: Core | "3 key personas" |
| Persona: Full | "All 5 personas" |
| Pacing label | "Processing Speed" |
| Pacing: Safe | "3s delay, best for large batches" |
| Pacing: Normal | "1s delay, balanced" |
| Pacing: Fast | "Minimal delay, may hit rate limits" |

### Step 3 (Confirm) Copy

| Element | Copy |
|---------|------|
| Ready message | "Ready to generate stories for {n} epics" |
| Skip note | "({m} epics will be skipped - already have stories)" |
| Replace note | "({m} epics will have stories replaced)" |
| Warning | "⚠️ This will use AI credits. Processing cannot be undone for completed epics, but you can cancel mid-run." |
| Submit button | "Generate Stories" |

### Progress Panel Copy

| Element | Copy |
|---------|------|
| Header (active) | "Processing Epic {n} of {total}: {title}" |
| Header (complete) | "Story Generation Complete" |
| Header (partial) | "Story Generation Completed with Errors" |
| Header (failed) | "Story Generation Failed" |
| Header (cancelled) | "Story Generation Cancelled" |
| Stats: Elapsed | "Elapsed: {time}" |
| Stats: Remaining | "Est. remaining: ~{time}" |
| Stats: Stories | "Total stories created: {n}" |

### Epic Status Copy

| Status | Copy |
|--------|------|
| PENDING | "Pending" |
| GENERATING | "Generating..." |
| SAVING | "Saving {n} stories..." |
| COMPLETED | "{n} stories · {time}" |
| FAILED | "Failed: {error}" |
| SKIPPED | "Skipped (has stories)" |

### Error Messages

| Scenario | Copy |
|----------|------|
| No active run | "No story generation in progress" |
| Already running | "A story generation is already in progress for this project" |
| Run not found | "Story generation run not found" |
| No failed epics | "No failed epics to retry" |
| API error | "Failed to generate stories: {message}" |
| Rate limited | "Rate limited. Waiting {n} seconds before retry..." |

---

## Appendix C: Test Matrix

### Core Test Cases

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Happy path (3 epics) | 3 epics, no stories | All complete, stories created |
| 2 | Zero epics | Empty project | Button disabled |
| 3 | Skip mode | 2 epics with stories | Stories preserved, epics skipped |
| 4 | Replace mode | 2 epics with stories | Old stories deleted, new created |
| 5 | Mock mode | No API key | Mock stories generated |
| 6 | Mid-run cancel | Cancel at epic 2/5 | Run cancelled, epic 1 preserved |
| 7 | Single failure | Epic 2 fails | Run continues, PARTIAL status |
| 8 | All fail | All epics fail | FAILED status |
| 9 | Retry failed | Previous PARTIAL run | New run with failed epics only |
| 10 | Concurrent prevention | Start while running | Second request blocked |
| 11 | Page refresh | Active run | Progress restored |
| 12 | Large batch | 25 epics, safe pacing | All complete, no rate limits |

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Epic deleted mid-run | Skip, continue to next |
| Project deleted mid-run | Run fails gracefully |
| DB connection lost | Run fails, error logged |
| Serverless timeout | Run fails at ~290s |
| Story generation returns empty | Epic marked failed, continues |
| Duplicate story titles | Accept (no uniqueness constraint) |

---

## Appendix D: Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Start run latency | < 500ms | Time from click to run created |
| Progress poll | < 200ms | Time to fetch and render progress |
| Epic processing | 5-30s | Per-epic, varies by mode |
| 10 epic batch | < 5 min | Safe pacing |
| 25 epic batch | < 15 min | Safe pacing |
| Memory usage | < 100MB | Node heap during execution |

---

*Document End*
