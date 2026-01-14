"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubtaskConfigDialog } from "./subtask-config-dialog";
import { SubtaskRunProgress } from "./subtask-run-progress";
import { useActiveSubtaskRun } from "@/hooks/use-subtask-progress";

interface Story {
  id: string;
  code: string;
  title: string;
  _count?: { subtasks: number };
}

interface SubtaskGenerationSectionProps {
  epicId: string;
  projectId: string;
  stories: Story[];
}

export function SubtaskGenerationSection({
  epicId,
  projectId,
  stories,
}: SubtaskGenerationSectionProps) {
  const router = useRouter();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { activeRunId: existingRunId, isChecking } = useActiveSubtaskRun(projectId);

  // Use existing run if found, or new run if started
  const runId = activeRunId || existingRunId;

  const handleStarted = (newRunId: string) => {
    setActiveRunId(newRunId);
  };

  const handleComplete = () => {
    setActiveRunId(null);
    router.refresh();
  };

  if (isChecking) {
    return null; // Or skeleton
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Subtask Generation</CardTitle>
        <CardDescription>
          Break down user stories into implementable subtasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {runId ? (
          <SubtaskRunProgress
            runId={runId}
            projectId={projectId}
            onClose={handleComplete}
          />
        ) : (
          <SubtaskConfigDialog
            epicId={epicId}
            stories={stories}
            onStarted={handleStarted}
          />
        )}
      </CardContent>
    </Card>
  );
}
