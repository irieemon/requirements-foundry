// ============================================
// Observability Module - Public API
// ============================================

// Logger
export { RunLogger, createRunLogger, logEvent } from "./logger";
export type { LogEvent, LogError } from "./logger";

// Heartbeat
export {
  updateHeartbeat,
  isHeartbeatStale,
  getStaleDuration,
  findStaleRuns,
  isRunStale,
  recoverStaleRun,
  recoverAllStaleRuns,
  getRunHealthStatus,
  STALE_THRESHOLD_MS,
  MAX_RECOVERY_AGE_MS,
} from "./heartbeat";
export type {
  StaleRun,
  RecoveryResult,
  BatchRecoveryResult,
  HealthStatus,
} from "./heartbeat";
