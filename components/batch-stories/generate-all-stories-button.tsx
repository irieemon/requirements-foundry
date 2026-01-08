"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { BatchStoryConfigDialog } from "./batch-story-config-dialog";
import { useActiveBatchStoryRun } from "@/hooks/use-batch-story-progress";

interface GenerateAllStoriesButtonProps {
  projectId: string;
  epicCount: number;
  disabled?: boolean;
}

/**
 * Entry point button for batch story generation.
 * Shows "Resume" if there's an active run, otherwise "Generate All Stories".
 */
export function GenerateAllStoriesButton({
  projectId,
  epicCount,
  disabled = false,
}: GenerateAllStoriesButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { activeRunId, isChecking, hasActiveRun } = useActiveBatchStoryRun(projectId);

  // If there's an active run, show the progress panel instead
  if (hasActiveRun && activeRunId) {
    return null; // Progress panel will be shown separately
  }

  const handleClick = () => {
    setDialogOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || epicCount === 0 || isChecking}
        variant="default"
        size="default"
      >
        {isChecking ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        Generate All Stories
        {epicCount > 0 && (
          <span className="ml-2 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs">
            {epicCount} epics
          </span>
        )}
      </Button>

      <BatchStoryConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        epicCount={epicCount}
      />
    </>
  );
}
