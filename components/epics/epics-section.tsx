"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EpicGrid, type EpicGridProps } from "@/components/epics/epic-grid";
import { GenerateEpicsButton } from "@/components/epics/generate-epics-button";
import {
  GenerateAllStoriesButton,
  BatchStoryRunProgress,
} from "@/components/batch-stories";
import { useActiveBatchStoryRun } from "@/hooks/use-batch-story-progress";
import { Download } from "lucide-react";
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
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const {
    activeRunId: fetchedRunId,
    isChecking,
    recoveredFromStale,
    previousRunId,
  } = useActiveBatchStoryRun(projectId);

  // Sync fetched active run ID
  useEffect(() => {
    if (!isChecking && fetchedRunId) {
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

  const handleRunStarted = (runId: string) => {
    setActiveRunId(runId);
  };

  const handleProgressClose = () => {
    setActiveRunId(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Generated Epics</h3>
          <p className="text-sm text-muted-foreground">
            {hasEpics
              ? `${epicCount} epic${epicCount !== 1 ? "s" : ""} with ${totalStories} stories`
              : "Epics synthesized from your use case cards."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateEpicsButton
            projectId={projectId}
            cardCount={cardCount}
            hasExistingEpics={hasEpics}
          />
          {hasEpics && !activeRunId && (
            <GenerateAllStoriesButton
              projectId={projectId}
              epicCount={epicCount}
            />
          )}
          {hasEpics && (
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/export`}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Export
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Epic Grid */}
      <EpicGrid projectId={projectId} epics={epics} />
    </div>
  );
}
