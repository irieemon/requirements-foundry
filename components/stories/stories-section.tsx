"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { StoryCard } from "./story-card";
import { FileText } from "lucide-react";

interface Story {
  id: string;
  code: string;
  title: string;
  userStory: string;
  persona: string | null;
  acceptanceCriteria: string | null;
  technicalNotes: string | null;
  priority: string | null;
  effort: string | null;
  _count?: { subtasks: number };
}

interface Epic {
  id: string;
  code: string;
  title: string;
  _count: { stories: number };
  stories: Story[];
}

interface StoriesSectionProps {
  epics: Epic[];
}

export function StoriesSection({ epics }: StoriesSectionProps) {
  const totalStories = epics.reduce((sum, epic) => sum + epic._count.stories, 0);
  const epicsWithStories = epics.filter(e => e._count.stories > 0).length;

  if (totalStories === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>User Stories</CardTitle>
          <CardDescription>Stories generated for this project&apos;s epics.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={FileText}
            title="No stories yet"
            description="Generate stories from epics in the Epics section."
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
          <CardTitle>User Stories</CardTitle>
          <CardDescription>
            {totalStories} stories across {epicsWithStories} epics
          </CardDescription>
        </CardHeader>
      </Card>

      {epics.filter(epic => epic.stories.length > 0).map(epic => (
        <Card key={epic.id} className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline">{epic.code}</Badge>
              {epic.title}
            </CardTitle>
            <CardDescription>{epic._count.stories} stories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {epic.stories.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  subtaskCount={story._count?.subtasks || 0}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
