"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, RotateCcw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunErrorInfo {
  message: string;
  phase?: string;
  uploadId?: string;
  uploadFilename?: string;
  isRetryable: boolean;
  suggestion?: string;
  code?: string;
}

interface RunErrorProps {
  error: RunErrorInfo;
  onRetry?: () => void;
  onRetryUpload?: (uploadId: string) => void;
  isRetrying?: boolean;
  className?: string;
}

/**
 * Error display for failed runs with retry capabilities.
 * Supports both full retry and granular per-upload retry.
 */
export function RunError({
  error,
  onRetry,
  onRetryUpload,
  isRetrying = false,
  className,
}: RunErrorProps) {
  return (
    <Alert
      variant="destructive"
      className={cn("relative", className)}
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {error.phase ? `Error in ${error.phase}` : "Analysis Failed"}
        {error.code && (
          <code className="text-xs font-mono bg-destructive/20 px-1.5 py-0.5 rounded">
            {error.code}
          </code>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{error.message}</p>

        {error.uploadFilename && (
          <p className="text-sm">
            Failed on:{" "}
            <code className="bg-destructive/10 px-1.5 py-0.5 rounded font-mono text-xs">
              {error.uploadFilename}
            </code>
          </p>
        )}

        {error.suggestion && (
          <p className="text-sm opacity-90">
            <strong>Suggestion:</strong> {error.suggestion}
          </p>
        )}

        {error.isRetryable && (
          <div className="flex flex-wrap gap-2 pt-2">
            {error.uploadId && onRetryUpload ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetryUpload(error.uploadId!)}
                  disabled={isRetrying}
                  className="bg-background"
                >
                  <RotateCcw
                    className={cn("mr-2 h-3 w-3", isRetrying && "motion-safe:animate-spin")}
                    aria-hidden="true"
                  />
                  Retry This Upload
                </Button>
                {onRetry && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onRetry}
                    disabled={isRetrying}
                  >
                    <RefreshCw
                      className={cn("mr-2 h-3 w-3", isRetrying && "motion-safe:animate-spin")}
                      aria-hidden="true"
                    />
                    Retry All
                  </Button>
                )}
              </>
            ) : (
              onRetry && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onRetry}
                  disabled={isRetrying}
                >
                  <RefreshCw
                    className={cn("mr-2 h-3 w-3", isRetrying && "motion-safe:animate-spin")}
                    aria-hidden="true"
                  />
                  {isRetrying ? "Retrying..." : "Retry Analysis"}
                </Button>
              )
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface UploadErrorRowProps {
  uploadId: string;
  filename: string;
  error: string;
  onRetry?: (uploadId: string) => void;
  isRetrying?: boolean;
}

/**
 * Compact error display for individual uploads within a run.
 */
export function UploadErrorRow({
  uploadId,
  filename,
  error,
  onRetry,
  isRetrying = false,
}: UploadErrorRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "border border-destructive/50 bg-destructive/5"
      )}
      role="alert"
    >
      <AlertCircle
        className="h-4 w-4 text-destructive mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" title={filename}>
          {filename}
        </p>
        <p className="text-sm text-destructive mt-1">{error}</p>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRetry(uploadId)}
          disabled={isRetrying}
          className="shrink-0"
        >
          <RotateCcw
            className={cn("h-3 w-3 mr-1", isRetrying && "motion-safe:animate-spin")}
            aria-hidden="true"
          />
          Retry
        </Button>
      )}
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * Minimal inline error for non-critical issues.
 */
export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <div
      className="flex items-center gap-2 text-sm text-destructive py-1"
      role="alert"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs underline hover:no-underline"
          aria-label="Dismiss error"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
