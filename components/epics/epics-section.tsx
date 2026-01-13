"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EpicGrid, type EpicGridProps } from "@/components/epics/epic-grid";
import { GenerateEpicsButton } from "@/components/epics/generate-epics-button";
import {
  BatchStoryConfigDialog,
  BatchStoryRunProgress,
} from "@/components/batch-stories";
import { PageActions, type ActionItem } from "@/components/layout/page-actions";
import { useActiveBatchStoryRun } from "@/hooks/use-batch-story-progress";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface EpicsSectionProps {
  projectId: string;
  epics: EpicGridProps["epics"];
  cardCount: number;
}

/**
 * Client wrapper for the Epics section that handles:
 * - Showing the "Generate All Stories" button
 * - Displaying the batch story progress panel when a run is active
 */
export function EpicsSection({ projectId, epics, cardCount }: EpicsSectionProps) {
  const router = useRouter();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const {
    activeRunId: fetchedRunId,
    isChecking,
    recoveredFromStale,
    previousRunId,
  } = useActiveBatchStoryRun(projectId);

  // Sync fetched active run ID (including clearing when no active run)
  useEffect(() => {
    if (!isChecking) {
      setActiveRunId(fetchedRunId);
    }
  }, [fetchedRunId, isChecking]);

  // Show toast if we recovered from a stale run
  useEffect(() => {
    if (recoveredFromStale && previousRunId) {
      toast.info("Recovered from stale run", {
        description: "A previous story generation was stuck and has been marked as failed. You can start a new generation.",
      });
    }
  }, [recoveredFromStale, previousRunId]);

  const epicCount = epics.length;
  const hasEpics = epicCount > 0;

  // Calculate total story count
  const totalStories = epics.reduce((sum, epic) => sum + (epic._count?.stories || 0), 0);

  const handleProgressClose = () => {
    setActiveRunId(null);
  };

  // Build secondary actions for the responsive action bar
  const buildSecondaryActions = (): ActionItem[] => {
    const actions: ActionItem[] = [];

    // Generate All Stories - only when epics exist and no active run
    if (hasEpics && !activeRunId) {
      actions.push({
        id: "generate-stories",
        label: `Generate All Stories${epicCount > 0 ? ` (${epicCount} epics)` : ""}`,
        icon: <Sparkles className="h-4 w-4" />,
        onClick: () => setStoryDialogOpen(true),
        disabled: epicCount === 0 || isChecking,
        content: (
          <Button
            onClick={() => setStoryDialogOpen(true)}
            disabled={epicCount === 0 || isChecking}
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
            Generate All Stories
            {epicCount > 0 && (
              <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
                {epicCount} epics
              </span>
            )}
          </Button>
        ),
      });
    }

    // Export - only when epics exist
    if (hasEpics) {
      actions.push({
        id: "export",
        label: "Export",
        icon: <Download className="h-4 w-4" />,
        onClick: () => router.push(`/projects/${projectId}/export`),
        content: (
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/export`}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Link>
          </Button>
        ),
      });
    }

    return actions;
  };

  return (
    <div className="space-y-6">
      {/* Active Batch Story Run Progress */}
      {activeRunId && (
        <BatchStoryRunProgress
          runId={activeRunId}
          projectId={projectId}
          onClose={handleProgressClose}
        />
      )}

      {/* Header with Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Generated Epics</h3>
          <p className="text-sm text-muted-foreground">
            {hasEpics
              ? `${epicCount} epic${epicCount !== 1 ? "s" : ""} with ${totalStories} stories`
              : "Epics synthesized from your use case cards."}
          </p>
        </div>
        <PageActions
          primaryAction={
            <GenerateEpicsButton
              projectId={projectId}
              cardCount={cardCount}
              hasExistingEpics={hasEpics}
            />
          }
          secondaryActions={buildSecondaryActions()}
        />
      </div>

      {/* Batch Story Config Dialog (controlled here for dropdown access) */}
      <BatchStoryConfigDialog
        open={storyDialogOpen}
        onOpenChange={setStoryDialogOpen}
        projectId={projectId}
        epicCount={epicCount}
        onRunStarted={setActiveRunId}
      />

      {/* Epic Grid */}
      <EpicGrid projectId={projectId} epics={epics} />
    </div>
  );
}
