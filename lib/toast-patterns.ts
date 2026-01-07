import { toast } from "sonner";

/**
 * Standardized toast patterns for run-related notifications.
 * Provides consistent messaging and behavior across the application.
 */
export const runToasts = {
  /**
   * Show when a run starts.
   */
  started: (runType: string, details?: { uploadCount?: number }) => {
    const typeLabel = getRunTypeLabel(runType);
    const description = details?.uploadCount
      ? `Processing ${details.uploadCount} upload${details.uploadCount !== 1 ? "s" : ""}...`
      : "Processing...";

    toast.info(`${typeLabel} started`, {
      description,
      duration: 3000,
    });
  },

  /**
   * Show when a phase completes.
   */
  phaseComplete: (phaseName: string, details?: { count?: number; item?: string }) => {
    const description = details?.count
      ? `${details.count} ${details.item || "items"} processed`
      : undefined;

    toast.success(`${phaseName} complete`, {
      description,
      duration: 2000,
    });
  },

  /**
   * Show when a run completes successfully.
   */
  completed: (
    runType: string,
    details: { cardCount?: number; epicCount?: number; storyCount?: number },
    options?: { onViewClick?: () => void }
  ) => {
    const typeLabel = getRunTypeLabel(runType);
    let description = "";

    if (runType === "EXTRACT_CARDS" && details.cardCount !== undefined) {
      description = `Extracted ${details.cardCount} use case card${details.cardCount !== 1 ? "s" : ""}`;
    } else if (runType === "GENERATE_EPICS" && details.epicCount !== undefined) {
      description = `Generated ${details.epicCount} epic${details.epicCount !== 1 ? "s" : ""}`;
    } else if (runType === "GENERATE_STORIES" && details.storyCount !== undefined) {
      description = `Generated ${details.storyCount} ${details.storyCount !== 1 ? "stories" : "story"}`;
    }

    toast.success(`${typeLabel} complete`, {
      description,
      duration: 5000,
      action: options?.onViewClick
        ? {
            label: "View Results",
            onClick: options.onViewClick,
          }
        : undefined,
    });
  },

  /**
   * Show when a run fails.
   */
  failed: (
    error: string,
    options?: { isRetryable?: boolean; onRetry?: () => void }
  ) => {
    toast.error("Analysis failed", {
      description: error,
      duration: options?.isRetryable ? 10000 : 5000,
      action:
        options?.isRetryable && options.onRetry
          ? {
              label: "Retry",
              onClick: options.onRetry,
            }
          : undefined,
    });
  },

  /**
   * Show when a specific upload fails within a run.
   */
  uploadFailed: (filename: string, error: string) => {
    toast.error(`Failed: ${filename}`, {
      description: error,
      duration: 5000,
    });
  },

  /**
   * Show when a retry is in progress.
   */
  retrying: () => {
    toast.info("Retrying...", {
      description: "Attempting to resume the analysis",
      duration: 2000,
    });
  },

  /**
   * Show when user tries to start a run while one is active.
   */
  runAlreadyActive: () => {
    toast.warning("Analysis in progress", {
      description: "Please wait for the current analysis to complete",
      duration: 3000,
    });
  },

  /**
   * Show when there are no uploads to analyze.
   */
  noUploads: () => {
    toast.warning("No uploads available", {
      description: "Upload content first before analyzing",
      duration: 3000,
    });
  },
};

/**
 * Get human-readable label for run type.
 */
function getRunTypeLabel(runType: string): string {
  switch (runType) {
    case "EXTRACT_CARDS":
      return "Card extraction";
    case "GENERATE_EPICS":
      return "Epic generation";
    case "GENERATE_STORIES":
      return "Story generation";
    case "EXPORT":
      return "Export";
    default:
      return "Analysis";
  }
}

/**
 * Generic toast patterns for other operations.
 */
export const appToasts = {
  /**
   * Show a success message.
   */
  success: (title: string, description?: string) => {
    toast.success(title, { description });
  },

  /**
   * Show an error message.
   */
  error: (title: string, description?: string) => {
    toast.error(title, { description });
  },

  /**
   * Show an info message.
   */
  info: (title: string, description?: string) => {
    toast.info(title, { description });
  },

  /**
   * Show a warning message.
   */
  warning: (title: string, description?: string) => {
    toast.warning(title, { description });
  },

  /**
   * Show a loading toast that can be updated.
   */
  loading: (title: string, description?: string) => {
    return toast.loading(title, { description });
  },

  /**
   * Dismiss a specific toast.
   */
  dismiss: (toastId: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Show a promise-based toast.
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },
};
