"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { SubtaskTable } from "./subtask-table";
import { ProjectSubtaskConfigDialog } from "./project-subtask-config-dialog";
import { SubtaskRunProgress } from "./subtask-run-progress";
import { useActiveSubtaskRun } from "@/hooks/use-subtask-progress";
import { ListTodo } from "lucide-react";

interface Subtask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  effort: string | null;
}

interface Story {
  id: string;
  code: string;
  title: string;
  subtasks: Subtask[];
  _count?: { subtasks: number };
}

interface Epic {
  id: string;
  code: string;
  title: string;
  stories: Story[];
}

interface SubtasksSectionProps {
  projectId: string;
  epics: Epic[];
}

export function SubtasksSection({ projectId, epics }: SubtasksSectionProps) {
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

  // Calculate totals
  const totalSubtasks = epics.reduce(
    (sum, epic) =>
      sum + epic.stories.reduce((storySum, story) => storySum + (story._count?.subtasks || story.subtasks?.length || 0), 0),
    0
  );

  // Total stories across all epics
  const totalStories = epics.reduce((sum, epic) => sum + epic.stories.length, 0);

  // Filter to epics that have stories with subtasks
  const epicsWithSubtasks = epics.filter(epic =>
    epic.stories.some(story => (story.subtasks?.length || 0) > 0)
  );

  const storiesWithSubtasks = epics.reduce(
    (sum, epic) => sum + epic.stories.filter(s => (s.subtasks?.length || 0) > 0).length,
    0
  );

  // Show progress if a run is active
  if (runId && !isChecking) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Subtask Generation</CardTitle>
          <CardDescription>Generating subtasks for user stories...</CardDescription>
        </CardHeader>
        <CardContent>
          <SubtaskRunProgress
            runId={runId}
            projectId={projectId}
            onClose={handleComplete}
          />
        </CardContent>
      </Card>
    );
  }

  if (totalSubtasks === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Subtasks</CardTitle>
            <CardDescription>Technical subtasks generated for user stories.</CardDescription>
          </div>
          {totalStories > 0 && (
            <ProjectSubtaskConfigDialog
              projectId={projectId}
              epics={epics}
              onStarted={handleStarted}
            />
          )}
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ListTodo}
            title="No subtasks yet"
            description={totalStories > 0
              ? "Click 'Generate Subtasks' to break down stories into implementable tasks."
              : "Add stories to your epics first, then generate subtasks."
            }
            compact
            action={totalStories > 0 ? (
              <ProjectSubtaskConfigDialog
                projectId={projectId}
                epics={epics}
                onStarted={handleStarted}
                trigger={
                  <Button variant="default" size="sm">
                    <ListTodo className="h-4 w-4 mr-2" />
                    Generate Subtasks
                  </Button>
                }
              />
            ) : undefined}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Subtasks</CardTitle>
            <CardDescription>
              {totalSubtasks} subtasks across {storiesWithSubtasks} stories in {epicsWithSubtasks.length} epics
            </CardDescription>
          </div>
          <ProjectSubtaskConfigDialog
            projectId={projectId}
            epics={epics}
            onStarted={handleStarted}
          />
        </CardHeader>
      </Card>

      {epicsWithSubtasks.map(epic => {
        const storiesInEpicWithSubtasks = epic.stories.filter(s => (s.subtasks?.length || 0) > 0);
        const epicSubtaskCount = storiesInEpicWithSubtasks.reduce(
          (sum, s) => sum + (s.subtasks?.length || 0),
          0
        );

        return (
          <Card key={epic.id} className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge variant="outline">{epic.code}</Badge>
                {epic.title}
              </CardTitle>
              <CardDescription>
                {epicSubtaskCount} subtasks across {storiesInEpicWithSubtasks.length} stories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {storiesInEpicWithSubtasks.map(story => (
                <div key={story.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                    <Badge variant="secondary" className="text-xs">{story.code}</Badge>
                    {story.title}
                    <span className="ml-auto text-xs">
                      {story.subtasks.length} subtasks
                    </span>
                  </div>
                  <SubtaskTable subtasks={story.subtasks} />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
