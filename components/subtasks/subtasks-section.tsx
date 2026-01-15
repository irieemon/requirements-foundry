"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { SubtaskTable } from "./subtask-table";
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
  epics: Epic[];
}

export function SubtasksSection({ epics }: SubtasksSectionProps) {
  // Calculate totals
  const totalSubtasks = epics.reduce(
    (sum, epic) =>
      sum + epic.stories.reduce((storySum, story) => storySum + (story._count?.subtasks || story.subtasks?.length || 0), 0),
    0
  );

  // Filter to epics that have stories with subtasks
  const epicsWithSubtasks = epics.filter(epic =>
    epic.stories.some(story => (story.subtasks?.length || 0) > 0)
  );

  const storiesWithSubtasks = epics.reduce(
    (sum, epic) => sum + epic.stories.filter(s => (s.subtasks?.length || 0) > 0).length,
    0
  );

  if (totalSubtasks === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Subtasks</CardTitle>
          <CardDescription>Technical subtasks generated for user stories.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={ListTodo}
            title="No subtasks yet"
            description="Generate subtasks from stories in the Epics section."
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Subtasks</CardTitle>
          <CardDescription>
            {totalSubtasks} subtasks across {storiesWithSubtasks} stories in {epicsWithSubtasks.length} epics
          </CardDescription>
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
