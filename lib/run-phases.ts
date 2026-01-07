/**
 * Phase configuration for different run types.
 * Defines the sequence of phases and their metadata.
 */

export interface PhaseConfig {
  id: string;
  label: string;
  description: string;
  /** Whether this phase includes per-upload breakdown */
  hasUploadBreakdown?: boolean;
  /** Estimated duration in ms (for progress estimation) */
  estimatedDurationMs?: number;
}

export const RUN_PHASES: Record<string, PhaseConfig[]> = {
  EXTRACT_CARDS: [
    {
      id: "init",
      label: "Initializing",
      description: "Setting up analysis run",
      estimatedDurationMs: 1000,
    },
    {
      id: "analyze",
      label: "Analyzing Uploads",
      description: "Processing document content",
      hasUploadBreakdown: true,
      estimatedDurationMs: 30000,
    },
    {
      id: "extract",
      label: "Extracting Cards",
      description: "Identifying use cases from content",
      estimatedDurationMs: 20000,
    },
    {
      id: "finalize",
      label: "Finalizing",
      description: "Saving extracted cards",
      estimatedDurationMs: 2000,
    },
  ],

  GENERATE_EPICS: [
    {
      id: "init",
      label: "Initializing",
      description: "Loading use case cards",
      estimatedDurationMs: 1000,
    },
    {
      id: "cluster",
      label: "Clustering Cards",
      description: "Grouping related use cases",
      estimatedDurationMs: 15000,
    },
    {
      id: "generate",
      label: "Generating Epics",
      description: "Creating epic definitions",
      estimatedDurationMs: 25000,
    },
    {
      id: "finalize",
      label: "Finalizing",
      description: "Saving generated epics",
      estimatedDurationMs: 2000,
    },
  ],

  GENERATE_STORIES: [
    {
      id: "init",
      label: "Initializing",
      description: "Loading epic context",
      estimatedDurationMs: 1000,
    },
    {
      id: "generate",
      label: "Generating Stories",
      description: "Creating user stories",
      estimatedDurationMs: 30000,
    },
    {
      id: "subtasks",
      label: "Creating Subtasks",
      description: "Breaking down stories into tasks",
      estimatedDurationMs: 15000,
    },
    {
      id: "finalize",
      label: "Finalizing",
      description: "Saving stories and subtasks",
      estimatedDurationMs: 2000,
    },
  ],

  EXPORT: [
    {
      id: "init",
      label: "Initializing",
      description: "Preparing export data",
      estimatedDurationMs: 1000,
    },
    {
      id: "format",
      label: "Formatting",
      description: "Converting to export format",
      estimatedDurationMs: 5000,
    },
    {
      id: "finalize",
      label: "Finalizing",
      description: "Creating export file",
      estimatedDurationMs: 2000,
    },
  ],
} as const;

/**
 * Get phase configuration for a run type.
 */
export function getPhaseConfig(runType: string): PhaseConfig[] {
  return RUN_PHASES[runType] ?? [];
}

/**
 * Get estimated total duration for a run type.
 */
export function getEstimatedDuration(runType: string): number {
  const phases = RUN_PHASES[runType] ?? [];
  return phases.reduce((sum, phase) => sum + (phase.estimatedDurationMs ?? 0), 0);
}

/**
 * Calculate estimated remaining time based on current phase.
 */
export function getEstimatedRemaining(
  runType: string,
  currentPhaseId: string,
  elapsedInCurrentPhase: number = 0
): number {
  const phases = RUN_PHASES[runType] ?? [];
  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);

  if (currentIndex === -1) return 0;

  let remaining = 0;

  // Add remaining time in current phase
  const currentPhase = phases[currentIndex];
  const currentEstimate = currentPhase.estimatedDurationMs ?? 0;
  remaining += Math.max(0, currentEstimate - elapsedInCurrentPhase);

  // Add time for subsequent phases
  for (let i = currentIndex + 1; i < phases.length; i++) {
    remaining += phases[i].estimatedDurationMs ?? 0;
  }

  return remaining;
}

/**
 * Phase status type for UI rendering.
 */
export type PhaseStatus = "pending" | "running" | "completed" | "failed";

/**
 * Transform run data into phase array for timeline rendering.
 */
export function buildPhaseTimeline(
  runType: string,
  currentPhaseId: string | null,
  completedPhases: Set<string>,
  failedPhase: string | null,
  phaseDurations: Record<string, number>,
  phaseData: Record<string, { uploads?: unknown[]; logs?: string[] }>
) {
  const config = getPhaseConfig(runType);

  return config.map((phase) => {
    let status: PhaseStatus = "pending";

    if (failedPhase === phase.id) {
      status = "failed";
    } else if (completedPhases.has(phase.id)) {
      status = "completed";
    } else if (currentPhaseId === phase.id) {
      status = "running";
    }

    return {
      id: phase.id,
      label: phase.label,
      description: phase.description,
      status,
      durationMs: phaseDurations[phase.id],
      uploads: phaseData[phase.id]?.uploads,
      logs: phaseData[phase.id]?.logs,
    };
  });
}
