// ============================================
// Structured Logger for Run Observability
// ============================================
// Provides correlation across serverless invocations,
// Claude API calls, and Vercel infrastructure.

type LogLevel = "info" | "warn" | "error";

export interface LogError {
  message: string;
  code?: string;
  stack?: string;
  retryable?: boolean;
}

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  event: string;
  runId: string;

  // Correlation identifiers
  epicId?: string;
  epicCode?: string;
  invocationId?: string;
  traceId?: string;
  claudeRequestId?: string;

  // Metrics
  duration?: number;

  // Flexible data
  metadata?: Record<string, unknown>;

  // Error details
  error?: LogError;
}

// ============================================
// Run Logger Class
// ============================================

export class RunLogger {
  private runId: string;
  private invocationId: string;
  private traceId?: string;
  private environment: string;
  private region?: string;
  private currentEpic?: { id: string; code: string; index: number };

  constructor(runId: string, request?: Request) {
    this.runId = runId;
    this.invocationId = crypto.randomUUID();
    this.traceId = request?.headers.get("x-vercel-trace") || undefined;
    this.environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
    this.region = process.env.VERCEL_REGION || undefined;
  }

  // ============================================
  // Epic Context Management
  // ============================================

  setCurrentEpic(epicId: string, epicCode: string, index: number): void {
    this.currentEpic = { id: epicId, code: epicCode, index };
  }

  clearCurrentEpic(): void {
    this.currentEpic = undefined;
  }

  // ============================================
  // Core Logging
  // ============================================

  private log(level: LogLevel, event: string, data?: Partial<LogEvent>): void {
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

    // Remove undefined fields for cleaner logs
    const cleanEvent = Object.fromEntries(
      Object.entries(logEvent).filter(([_, v]) => v !== undefined)
    );

    // Use JSON for structured logging (Vercel parses this automatically)
    const logFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    logFn(JSON.stringify(cleanEvent));
  }

  info(event: string, data?: Partial<LogEvent>): void {
    this.log("info", event, data);
  }

  warn(event: string, data?: Partial<LogEvent>): void {
    this.log("warn", event, data);
  }

  error(event: string, error: Error | string, data?: Partial<LogEvent>): void {
    const errorInfo: LogError =
      typeof error === "string"
        ? { message: error }
        : {
            message: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            code: (error as NodeJS.ErrnoException).code,
          };

    this.log("error", event, { ...data, error: errorInfo });
  }

  // ============================================
  // Run Lifecycle Events
  // ============================================

  runCreated(projectId: string, totalEpics: number, options: Record<string, unknown>): void {
    this.info("run.created", {
      metadata: {
        projectId,
        totalEpics,
        options,
        environment: this.environment,
        region: this.region,
      },
    });
  }

  runStarted(totalEpics: number, options: Record<string, unknown>): void {
    this.info("run.started", {
      metadata: {
        totalEpics,
        options,
        environment: this.environment,
        region: this.region,
      },
    });
  }

  runCompleted(stats: {
    duration: number;
    success: number;
    failed: number;
    skipped: number;
    stories: number;
  }): void {
    this.info("run.completed", {
      duration: stats.duration,
      metadata: {
        successCount: stats.success,
        failedCount: stats.failed,
        skippedCount: stats.skipped,
        totalStories: stats.stories,
      },
    });
  }

  runFailed(error: Error | string, lastEpicCode?: string, epicProgress?: string): void {
    const errorInfo: LogError =
      typeof error === "string"
        ? { message: error }
        : { message: error.message, stack: error.stack };

    this.log("error", "run.failed", {
      error: errorInfo,
      metadata: { lastEpicCode, epicProgress },
    });
  }

  runCancelled(cancelledBy: string, epicProgress: string): void {
    this.warn("run.cancelled", {
      metadata: { cancelledBy, epicProgress },
    });
  }

  runStaleDetected(lastHeartbeat: Date | null, staleDurationMs: number): void {
    this.warn("run.stale_detected", {
      metadata: {
        lastHeartbeat: lastHeartbeat?.toISOString() || null,
        staleDurationMs,
      },
    });
  }

  runRecovered(recoveryAction: string): void {
    this.info("run.recovered", {
      metadata: { recoveryAction },
    });
  }

  // ============================================
  // Epic Processing Events
  // ============================================

  epicStarted(epicId: string, epicCode: string, index: number, totalEpics: number): void {
    this.setCurrentEpic(epicId, epicCode, index);
    this.info("epic.started", {
      metadata: { epicIndex: index, totalEpics },
    });
  }

  epicSkipped(reason: string, existingStoryCount?: number): void {
    this.info("epic.skipped", {
      metadata: { reason, existingStoryCount },
    });
    this.clearCurrentEpic();
  }

  epicCompleted(storyCount: number, duration: number, storiesDeleted?: number): void {
    this.info("epic.completed", {
      duration,
      metadata: { storyCount, storiesDeleted },
    });
    this.clearCurrentEpic();
  }

  epicFailed(error: Error | string, retryable: boolean = false): void {
    const errorInfo: LogError =
      typeof error === "string"
        ? { message: error, retryable }
        : { message: error.message, stack: error.stack, retryable };

    this.log("error", "epic.failed", { error: errorInfo });
    this.clearCurrentEpic();
  }

  epicRetryScheduled(retryCount: number, nextRetryMs: number): void {
    this.warn("epic.retry_scheduled", {
      metadata: { retryCount, nextRetryMs },
    });
  }

  // ============================================
  // Claude API Events
  // ============================================

  claudeRequest(model: string, tokenEstimate?: number): void {
    this.info("epic.claude_request", {
      metadata: { model, tokenEstimate },
    });
  }

  claudeResponse(
    claudeRequestId: string | undefined,
    tokensUsed: number,
    duration: number
  ): void {
    this.info("epic.claude_response", {
      claudeRequestId,
      duration,
      metadata: { tokensUsed },
    });
  }

  claudeTimeout(elapsed: number, timeout: number): void {
    this.error("epic.claude_timeout", `Request timed out after ${elapsed}ms (limit: ${timeout}ms)`, {
      duration: elapsed,
      metadata: { timeout },
    });
  }

  claudeError(error: Error | string, claudeRequestId?: string): void {
    const errorInfo: LogError =
      typeof error === "string"
        ? { message: error, retryable: true }
        : { message: error.message, stack: error.stack, retryable: true };

    this.log("error", "epic.claude_error", {
      claudeRequestId,
      error: errorInfo,
    });
  }

  // ============================================
  // Invocation Events
  // ============================================

  invocationStarted(remainingEpics: number): void {
    this.info("invocation.started", {
      metadata: {
        remainingEpics,
        environment: this.environment,
        region: this.region,
      },
    });
  }

  invocationCompleted(epicProcessed: string | null, duration: number): void {
    this.info("invocation.completed", {
      duration,
      metadata: { epicProcessed },
    });
  }

  invocationTimeoutWarning(elapsed: number, maxDuration: number): void {
    this.warn("invocation.timeout_warning", {
      duration: elapsed,
      metadata: { maxDuration, remainingMs: maxDuration - elapsed },
    });
  }

  continuationTriggered(url: string): void {
    this.info("invocation.continuation_triggered", {
      metadata: { nextInvocationUrl: url },
    });
  }

  continuationFailed(error: Error): void {
    this.error("invocation.continuation_failed", error);
  }

  // ============================================
  // Database Events
  // ============================================

  dbRunUpdated(status: string, phase: string): void {
    this.info("db.run_updated", {
      metadata: { status, phase },
    });
  }

  dbEpicUpdated(epicId: string, status: string): void {
    this.info("db.epic_updated", {
      epicId,
      metadata: { status },
    });
  }

  dbHeartbeatUpdated(): void {
    this.info("db.heartbeat_updated", {
      metadata: { heartbeatAt: new Date().toISOString() },
    });
  }

  dbConnectionError(error: Error, operation: string): void {
    this.error("db.connection_error", error, {
      metadata: { operation },
    });
  }

  // ============================================
  // Request/Connection Events
  // ============================================

  requestAbort(reason: string): void {
    this.warn("request.abort", {
      metadata: { reason },
    });
  }

  requestTimeout(elapsed: number, maxDuration: number): void {
    this.error("request.timeout", `Request timed out after ${elapsed}ms`, {
      duration: elapsed,
      metadata: { maxDuration },
    });
  }
}

// ============================================
// Factory Function
// ============================================

export function createRunLogger(runId: string, request?: Request): RunLogger {
  return new RunLogger(runId, request);
}

// ============================================
// Simple logging for non-run contexts
// ============================================

export function logEvent(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const logFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  logFn(JSON.stringify(logEntry));
}
