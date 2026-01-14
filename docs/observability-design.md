# Observability Design for Requirements Foundry

## Problem Context

Story generation via Claude API experiences the following issues on Vercel:
- "Client disconnected" errors in Claude console
- Runs stuck in RUNNING state indefinitely
- Inability to correlate events across request lifecycle
- No visibility into where disconnects occur

The current continuation pattern (`process-next-trigger.ts`) works around Vercel timeout limits but lacks comprehensive observability.

---

## 1. Correlation Strategy

### 1.1 Correlation Identifiers

| Identifier | Source | Purpose |
|------------|--------|---------|
| `runId` | Database (CUID) | Primary correlation key across all events |
| `epicId` | Database (CUID) | Correlate epic-specific events |
| `invocationId` | Generated (UUID) | Track individual serverless invocations |
| `claudeRequestId` | Anthropic SDK response header | Correlate with Claude API logs |
| `traceId` | Vercel (x-vercel-trace) | Correlate with Vercel dashboard |

### 1.2 Correlation Flow

```
[Client Request]
     |
     v
[startGenerateAllStories] --> runId created
     |
     v
[triggerProcessNext(runId)] --> fire-and-forget
     |
     v
[POST /api/runs/{runId}/process-next]
     |-- invocationId = crypto.randomUUID()
     |-- traceId = req.headers['x-vercel-trace']
     |
     v
[Claude API Call]
     |-- claudeRequestId = response.headers['request-id']
     |
     v
[triggerProcessNext(runId)] --> self-invocation for continuation
```

### 1.3 Structured Log Context

```typescript
interface LogContext {
  // Always present
  runId: string;
  timestamp: string;

  // Per invocation
  invocationId?: string;
  traceId?: string;

  // Epic processing
  epicId?: string;
  epicCode?: string;
  epicIndex?: number;
  totalEpics?: number;

  // Claude API
  claudeRequestId?: string;

  // Environment
  environment: 'development' | 'preview' | 'production';
  region?: string;
}
```

---

## 2. Log Event Catalog

### 2.1 Structured Log Format

```typescript
interface LogEvent {
  timestamp: string;              // ISO 8601
  level: 'info' | 'warn' | 'error';
  event: string;                  // Dot-notation event name
  runId: string;

  // Optional correlation
  epicId?: string;
  epicCode?: string;
  invocationId?: string;
  traceId?: string;
  claudeRequestId?: string;

  // Event-specific data
  duration?: number;              // milliseconds
  metadata?: Record<string, unknown>;

  // Error details
  error?: {
    message: string;
    code?: string;
    stack?: string;
    retryable?: boolean;
  };
}
```

### 2.2 Run Lifecycle Events

| Event | Level | Fields | When |
|-------|-------|--------|------|
| `run.created` | info | runId, projectId, totalEpics, options | Run record created |
| `run.started` | info | runId, invocationId | First process-next begins |
| `run.heartbeat` | info | runId, lastEpicCode, epicProgress | After each epic |
| `run.completed` | info | runId, duration, successCount, failedCount, skippedCount, totalStories | All epics processed |
| `run.failed` | error | runId, error, lastEpicCode, epicProgress | Fatal run error |
| `run.cancelled` | warn | runId, cancelledBy, epicProgress | User cancellation |
| `run.stale_detected` | warn | runId, lastHeartbeat, staleDuration | Stale run detected |
| `run.recovered` | info | runId, recoveryAction | Stale run recovered |

### 2.3 Epic Processing Events

| Event | Level | Fields | When |
|-------|-------|--------|------|
| `epic.started` | info | runId, epicId, epicCode, epicIndex, totalEpics | Epic processing begins |
| `epic.skipped` | info | runId, epicId, epicCode, reason, existingStoryCount | Epic skipped |
| `epic.claude_request` | info | runId, epicId, invocationId, model, tokenEstimate | Before Claude API call |
| `epic.claude_response` | info | runId, epicId, claudeRequestId, tokensUsed, duration | After Claude response |
| `epic.claude_timeout` | error | runId, epicId, invocationId, elapsed, timeout | Claude call timeout |
| `epic.stories_saved` | info | runId, epicId, storyCount, storiesDeleted | Stories persisted |
| `epic.completed` | info | runId, epicId, epicCode, storyCount, duration | Epic fully processed |
| `epic.failed` | error | runId, epicId, epicCode, error, retryable | Epic processing error |
| `epic.retry_scheduled` | warn | runId, epicId, retryCount, nextRetryMs | Retry scheduled |

### 2.4 Connection & Invocation Events

| Event | Level | Fields | When |
|-------|-------|--------|------|
| `invocation.started` | info | runId, invocationId, traceId, remainingEpics | New serverless invocation |
| `invocation.completed` | info | runId, invocationId, epicProcessed, duration | Invocation finishing |
| `invocation.timeout_warning` | warn | runId, invocationId, elapsed, maxDuration | Approaching timeout |
| `invocation.continuation_triggered` | info | runId, invocationId, nextInvocationUrl | Fire-and-forget trigger |
| `invocation.continuation_failed` | error | runId, invocationId, error | Continuation trigger failed |
| `request.abort` | warn | runId, epicId, invocationId, reason | Request aborted |
| `request.timeout` | error | runId, epicId, elapsed, maxDuration | Request timeout |

### 2.5 Database Events (Critical Path)

| Event | Level | Fields | When |
|-------|-------|--------|------|
| `db.run_updated` | info | runId, status, phase | Run status change |
| `db.epic_updated` | info | runId, epicId, status | Epic status change |
| `db.heartbeat_updated` | info | runId, heartbeatAt | Heartbeat written |
| `db.connection_error` | error | runId, error, operation | DB connection failed |

---

## 3. Implementation Design

### 3.1 Logger Module

Create `/lib/observability/logger.ts`:

```typescript
type LogLevel = 'info' | 'warn' | 'error';

interface LogEvent {
  timestamp: string;
  level: LogLevel;
  event: string;
  runId: string;
  epicId?: string;
  epicCode?: string;
  invocationId?: string;
  traceId?: string;
  claudeRequestId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
    retryable?: boolean;
  };
}

class RunLogger {
  private runId: string;
  private invocationId: string;
  private traceId?: string;
  private environment: string;
  private currentEpic?: { id: string; code: string; index: number };

  constructor(runId: string, request?: Request) {
    this.runId = runId;
    this.invocationId = crypto.randomUUID();
    this.traceId = request?.headers.get('x-vercel-trace') || undefined;
    this.environment = process.env.VERCEL_ENV || 'development';
  }

  setCurrentEpic(epicId: string, epicCode: string, index: number) {
    this.currentEpic = { id: epicId, code: epicCode, index };
  }

  clearCurrentEpic() {
    this.currentEpic = undefined;
  }

  private log(level: LogLevel, event: string, data?: Partial<LogEvent>) {
    const logEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      event,
      runId: this.runId,
      invocationId: this.invocationId,
      traceId: this.traceId,
      epicId: this.currentEpic?.id,
      epicCode: this.currentEpic?.code,
      ...data,
    };

    // Remove undefined fields
    const cleanEvent = Object.fromEntries(
      Object.entries(logEvent).filter(([_, v]) => v !== undefined)
    );

    // Use JSON for structured logging (Vercel parses this)
    const logFn = level === 'error' ? console.error :
                  level === 'warn' ? console.warn : console.log;

    logFn(JSON.stringify(cleanEvent));
  }

  info(event: string, data?: Partial<LogEvent>) {
    this.log('info', event, data);
  }

  warn(event: string, data?: Partial<LogEvent>) {
    this.log('warn', event, data);
  }

  error(event: string, error: Error | string, data?: Partial<LogEvent>) {
    const errorInfo = typeof error === 'string'
      ? { message: error }
      : {
          message: error.message,
          stack: error.stack,
          code: (error as any).code
        };

    this.log('error', event, { ...data, error: errorInfo });
  }

  // Convenience methods for common events
  runStarted(totalEpics: number, options: Record<string, unknown>) {
    this.info('run.started', {
      metadata: { totalEpics, options, environment: this.environment }
    });
  }

  runCompleted(stats: { duration: number; success: number; failed: number; skipped: number; stories: number }) {
    this.info('run.completed', {
      duration: stats.duration,
      metadata: {
        successCount: stats.success,
        failedCount: stats.failed,
        skippedCount: stats.skipped,
        totalStories: stats.stories
      }
    });
  }

  epicStarted(epicId: string, epicCode: string, index: number, totalEpics: number) {
    this.setCurrentEpic(epicId, epicCode, index);
    this.info('epic.started', {
      metadata: { epicIndex: index, totalEpics }
    });
  }

  epicCompleted(storyCount: number, duration: number) {
    this.info('epic.completed', {
      duration,
      metadata: { storyCount }
    });
    this.clearCurrentEpic();
  }

  epicFailed(error: Error | string, retryable: boolean = false) {
    const errorInfo = typeof error === 'string' ? { message: error, retryable }
      : { message: error.message, stack: error.stack, retryable };
    this.error('epic.failed', error, { error: errorInfo });
    this.clearCurrentEpic();
  }

  claudeRequest(tokenEstimate?: number) {
    this.info('epic.claude_request', {
      metadata: {
        model: 'claude-sonnet-4-20250514',
        tokenEstimate
      }
    });
  }

  claudeResponse(claudeRequestId: string | undefined, tokensUsed: number, duration: number) {
    this.info('epic.claude_response', {
      claudeRequestId,
      duration,
      metadata: { tokensUsed }
    });
  }

  continuationTriggered(url: string) {
    this.info('invocation.continuation_triggered', {
      metadata: { nextInvocationUrl: url }
    });
  }

  continuationFailed(error: Error) {
    this.error('invocation.continuation_failed', error);
  }
}

export function createRunLogger(runId: string, request?: Request): RunLogger {
  return new RunLogger(runId, request);
}

export type { RunLogger, LogEvent };
```

### 3.2 Heartbeat System

Add to the Run model (requires schema update):

```prisma
model Run {
  // ... existing fields ...
  heartbeatAt    DateTime?  // Last heartbeat timestamp
}
```

Create `/lib/observability/heartbeat.ts`:

```typescript
import { db } from "@/lib/db";

const HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
const STALE_THRESHOLD_MS = 60000;    // 1 minute = stale

export async function updateHeartbeat(runId: string): Promise<void> {
  await db.run.update({
    where: { id: runId },
    data: { heartbeatAt: new Date() }
  });
}

export async function findStaleRuns(): Promise<Array<{ id: string; heartbeatAt: Date | null }>> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  return db.run.findMany({
    where: {
      status: 'RUNNING',
      OR: [
        { heartbeatAt: { lt: staleThreshold } },
        { heartbeatAt: null }
      ]
    },
    select: { id: true, heartbeatAt: true }
  });
}

export async function recoverStaleRun(runId: string): Promise<boolean> {
  // Check if there are pending epics
  const pendingEpic = await db.runEpic.findFirst({
    where: { runId, status: 'PENDING' }
  });

  if (pendingEpic) {
    // Trigger continuation
    const { triggerProcessNext } = await import('@/lib/run-engine/process-next-trigger');
    triggerProcessNext(runId);
    return true;
  }

  // No pending epics - mark as potentially stuck
  return false;
}
```

### 3.3 Integration Points

Update `/app/api/runs/[id]/process-next/route.ts`:

```typescript
// At start of handler
const logger = createRunLogger(runId, request);
logger.info('invocation.started', {
  metadata: { remainingEpics: await getPendingEpicCount(runId) }
});

// Before Claude API call
logger.claudeRequest(estimatedTokens);

// After Claude API call
const claudeRequestId = response.headers?.['request-id'];
logger.claudeResponse(claudeRequestId, result.tokensUsed, duration);

// When triggering continuation
logger.continuationTriggered(url);

// On completion
logger.info('invocation.completed', {
  epicProcessed: epic.code,
  duration: Date.now() - startTime
});
```

---

## 4. Verification Checklist

### 4.1 Pre-Deployment Verification

- [ ] Logger module compiles without errors
- [ ] Heartbeat schema migration applied
- [ ] Environment variables documented
- [ ] Log levels appropriate for environment

### 4.2 Deployment Verification (Vercel Dashboard)

**Run Creation:**
- [ ] `run.created` event logged with runId, projectId, totalEpics
- [ ] `invocation.started` event includes traceId

**Epic Processing:**
- [ ] `epic.started` logged for each epic with correct index
- [ ] `epic.claude_request` logged before API call
- [ ] `epic.claude_response` includes claudeRequestId and tokensUsed
- [ ] `epic.completed` includes duration and storyCount

**Continuation Pattern:**
- [ ] `invocation.continuation_triggered` shows next invocation URL
- [ ] New `invocation.started` appears within 5 seconds
- [ ] No gaps in epic sequence (all epics accounted for)

**Completion:**
- [ ] `run.completed` logged with accurate statistics
- [ ] Duration calculation matches startedAt to completedAt

### 4.3 Error Scenario Verification

**Claude API Timeout:**
- [ ] `epic.claude_timeout` logged with elapsed time
- [ ] Error includes retryable flag
- [ ] `epic.retry_scheduled` logged if retry configured

**Client Disconnect (simulated):**
- [ ] Run continues processing despite disconnect
- [ ] Heartbeat continues updating
- [ ] `run.completed` eventually logged

**Stale Run Detection:**
- [ ] `run.stale_detected` logged after threshold
- [ ] `run.recovered` logged if continuation succeeds

### 4.4 No Orphaned States Check

Run this query after processing:
```sql
SELECT id, status, phase, heartbeatAt, completedAt
FROM Run
WHERE status = 'RUNNING'
  AND completedAt IS NULL
  AND (heartbeatAt < NOW() - INTERVAL '5 minutes' OR heartbeatAt IS NULL);
```

Expected: 0 rows after all processing completes.

---

## 5. Vercel-Specific Considerations

### 5.1 Accessing Logs in Vercel Dashboard

1. Navigate to **Project > Deployments > [deployment] > Functions**
2. Select the function (e.g., `app/api/runs/[id]/process-next`)
3. View **Logs** tab for real-time logs
4. Use **Runtime Logs** for historical data (Vercel Pro feature)

### 5.2 Log Retention

| Plan | Retention | Search |
|------|-----------|--------|
| Hobby | 1 hour | No search |
| Pro | 3 days | Full text search |
| Enterprise | Custom | Advanced filtering |

### 5.3 Filtering in Vercel Logs

Use structured JSON logging for searchability:
```
runId:cuid_xxx
event:epic.failed
level:error
```

### 5.4 Recommended Integrations

**Option A: Vercel Log Drains (Pro)**
- Export to Datadog, Axiom, or custom endpoint
- Longer retention and advanced analytics

**Option B: Inline Structured Logging (Current Recommendation)**
- Use `console.log(JSON.stringify(event))` pattern
- Vercel parses JSON automatically
- Searchable in Vercel dashboard

**Option C: Third-Party APM**
- Consider Sentry for error tracking
- Consider Axiom or Datadog for full observability

### 5.5 Performance Considerations

- Structured logging adds ~1-2ms per log call
- Heartbeat updates add ~10-50ms database round-trip
- Consider batching heartbeat updates for high-volume scenarios

---

## 6. Migration Path

### Phase 1: Minimal Logging (Immediate)
1. Add structured `console.log` statements at key points
2. Use JSON format for Vercel parsing
3. Include runId in all logs

### Phase 2: Full Observability (Week 1)
1. Implement RunLogger class
2. Add heartbeat system with schema migration
3. Update process-next route with full instrumentation

### Phase 3: Stale Run Recovery (Week 2)
1. Implement stale run detection cron
2. Add automatic recovery mechanism
3. Add alerting integration (optional)

---

## 7. Example Log Sequence

Successful 3-epic run:
```json
{"timestamp":"2024-01-15T10:00:00.000Z","level":"info","event":"run.created","runId":"clr123","metadata":{"totalEpics":3}}
{"timestamp":"2024-01-15T10:00:00.100Z","level":"info","event":"invocation.started","runId":"clr123","invocationId":"inv-001","traceId":"abc123"}
{"timestamp":"2024-01-15T10:00:00.200Z","level":"info","event":"epic.started","runId":"clr123","epicId":"epic1","epicCode":"E1","metadata":{"epicIndex":1,"totalEpics":3}}
{"timestamp":"2024-01-15T10:00:00.300Z","level":"info","event":"epic.claude_request","runId":"clr123","epicId":"epic1"}
{"timestamp":"2024-01-15T10:00:05.500Z","level":"info","event":"epic.claude_response","runId":"clr123","epicId":"epic1","claudeRequestId":"req_xyz","duration":5200,"metadata":{"tokensUsed":3500}}
{"timestamp":"2024-01-15T10:00:06.000Z","level":"info","event":"epic.completed","runId":"clr123","epicId":"epic1","epicCode":"E1","duration":5800,"metadata":{"storyCount":8}}
{"timestamp":"2024-01-15T10:00:06.100Z","level":"info","event":"invocation.continuation_triggered","runId":"clr123","invocationId":"inv-001"}
{"timestamp":"2024-01-15T10:00:06.500Z","level":"info","event":"invocation.started","runId":"clr123","invocationId":"inv-002","traceId":"def456"}
{"timestamp":"2024-01-15T10:00:06.600Z","level":"info","event":"epic.started","runId":"clr123","epicId":"epic2","epicCode":"E2","metadata":{"epicIndex":2,"totalEpics":3}}
...
{"timestamp":"2024-01-15T10:00:25.000Z","level":"info","event":"run.completed","runId":"clr123","duration":25000,"metadata":{"successCount":3,"failedCount":0,"skippedCount":0,"totalStories":24}}
```

---

## 8. Files to Create/Modify

### New Files
- `/lib/observability/logger.ts` - RunLogger class and factory
- `/lib/observability/heartbeat.ts` - Heartbeat system
- `/lib/observability/stale-recovery.ts` - Stale run detection and recovery
- `/app/api/cron/recover-stale-runs/route.ts` - Cron endpoint (optional)

### Modified Files
- `/app/api/runs/[id]/process-next/route.ts` - Add logging instrumentation
- `/lib/run-engine/process-next-trigger.ts` - Add continuation logging
- `/lib/ai/provider.ts` - Add Claude request/response logging
- `/prisma/schema.prisma` - Add heartbeatAt field to Run model

---

## Summary

This observability design provides:

1. **Correlation Strategy**: Clear identifiers (runId, invocationId, claudeRequestId, traceId) to trace requests across the entire lifecycle

2. **Comprehensive Log Events**: 25+ event types covering run lifecycle, epic processing, Claude API interactions, and connection events

3. **Structured Logging**: JSON format compatible with Vercel's log parsing and search

4. **Heartbeat System**: Detect and recover from stale runs caused by disconnects

5. **Vercel Integration**: Leverages Vercel's built-in log infrastructure with clear guidance on accessing and searching logs

6. **Verification Checklist**: Concrete steps to confirm the fix is working in production
