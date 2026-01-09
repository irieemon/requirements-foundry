"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RunProgress, RunStatus as RunStatusType } from "@/lib/types";
import { RunStatus } from "@/lib/types";

interface UseRunProgressOptions {
  /** Polling interval in milliseconds (default: 1000) */
  pollInterval?: number;
  /** Callback when run completes successfully */
  onComplete?: (progress: RunProgress) => void;
  /** Callback when run fails */
  onError?: (progress: RunProgress) => void;
  /** Callback when run is cancelled */
  onCancel?: (progress: RunProgress) => void;
  /** Auto-refresh page when complete */
  autoRefresh?: boolean;
}

interface UseRunProgressReturn {
  progress: RunProgress | null;
  isLoading: boolean;
  error: string | null;
  isPolling: boolean;
  isActive: boolean;
  isComplete: boolean;
  startPolling: (runId: string) => void;
  stopPolling: () => void;
  refresh: () => Promise<void>;
}

const TERMINAL_STATUSES: RunStatusType[] = [
  RunStatus.SUCCEEDED,
  RunStatus.FAILED,
  RunStatus.CANCELLED,
];

export function useRunProgress(
  initialRunId?: string | null,
  options: UseRunProgressOptions = {}
): UseRunProgressReturn {
  const {
    pollInterval = 1000,
    onComplete,
    onError,
    onCancel,
    autoRefresh = true,
  } = options;

  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(initialRunId || null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchProgress = useCallback(async (id: string): Promise<RunProgress | null> => {
    try {
      const response = await fetch(`/api/runs/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Run not found");
        }
        throw new Error(`Failed to fetch progress: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      throw err;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const handleTerminalState = useCallback(
    (prog: RunProgress) => {
      stopPolling();

      switch (prog.status) {
        case RunStatus.SUCCEEDED:
          onComplete?.(prog);
          if (autoRefresh) {
            router.refresh();
          }
          break;
        case RunStatus.FAILED:
          onError?.(prog);
          break;
        case RunStatus.CANCELLED:
          onCancel?.(prog);
          if (autoRefresh) {
            router.refresh();
          }
          break;
      }
    },
    [stopPolling, onComplete, onError, onCancel, autoRefresh, router]
  );

  const pollProgress = useCallback(
    async (id: string) => {
      if (!isMountedRef.current) return;

      try {
        const prog = await fetchProgress(id);
        if (!prog || !isMountedRef.current) return;

        setProgress(prog);
        setError(null);

        // Check for terminal state
        if (TERMINAL_STATUSES.includes(prog.status)) {
          handleTerminalState(prog);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch progress");
        }
      }
    },
    [fetchProgress, handleTerminalState]
  );

  const startPolling = useCallback(
    (id: string) => {
      // Stop any existing polling
      stopPolling();

      setRunId(id);
      setProgress(null);
      setError(null);
      setIsLoading(true);
      setIsPolling(true);

      // Initial fetch
      pollProgress(id).finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      });

      // Start polling interval
      intervalRef.current = setInterval(() => {
        pollProgress(id);
      }, pollInterval);
    },
    [stopPolling, pollProgress, pollInterval]
  );

  const refresh = useCallback(async () => {
    if (!runId) return;
    setIsLoading(true);
    try {
      const prog = await fetchProgress(runId);
      if (prog && isMountedRef.current) {
        setProgress(prog);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch progress");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [runId, fetchProgress]);

  // Handle initial runId
  useEffect(() => {
    if (initialRunId) {
      startPolling(initialRunId);
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [initialRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  const isActive =
    progress?.status === RunStatus.RUNNING || progress?.status === RunStatus.QUEUED;
  const isComplete = progress
    ? TERMINAL_STATUSES.includes(progress.status)
    : false;

  return {
    progress,
    isLoading,
    error,
    isPolling,
    isActive,
    isComplete,
    startPolling,
    stopPolling,
    refresh,
  };
}

/**
 * Response from active-run endpoint with stale recovery info.
 */
interface ActiveRunResponse {
  runId: string | null;
  recoveredFromStale: boolean;
  previousRunId: string | null;
}

/**
 * Simplified hook for just checking if a project has an active run.
 * Also detects and reports stale run recovery.
 */
export function useActiveRun(projectId: string) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [recoveredFromStale, setRecoveredFromStale] = useState(false);
  const [previousRunId, setPreviousRunId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const checkActiveRun = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/active-run`, {
          cache: "no-store",
        });
        if (response.ok && !isCancelled) {
          const data: ActiveRunResponse = await response.json();
          setActiveRunId(data.runId || null);
          setRecoveredFromStale(data.recoveredFromStale || false);
          setPreviousRunId(data.previousRunId || null);
        }
      } catch {
        // Silently fail
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    };

    checkActiveRun();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  return {
    activeRunId,
    isChecking,
    hasActiveRun: !!activeRunId,
    recoveredFromStale,
    previousRunId,
  };
}
