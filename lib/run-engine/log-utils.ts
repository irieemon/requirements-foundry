import { db } from "@/lib/db";

/**
 * Atomically append a log message to a run's logs field.
 * Uses raw SQL to avoid read-then-write race condition.
 */
export async function appendRunLog(
  runId: string,
  message: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  // Use raw SQL CONCAT to atomically append
  // This avoids the race condition where two processes
  // read the same logs value and one overwrites the other
  await db.$executeRaw`
    UPDATE "Run"
    SET logs = COALESCE(logs, '') || ${logEntry}
    WHERE id = ${runId}
  `;
}

/**
 * Atomically append multiple log messages at once.
 */
export async function appendRunLogs(
  runId: string,
  messages: string[]
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntries = messages
    .map(msg => `[${timestamp}] ${msg}`)
    .join('\n') + '\n';

  await db.$executeRaw`
    UPDATE "Run"
    SET logs = COALESCE(logs, '') || ${logEntries}
    WHERE id = ${runId}
  `;
}
