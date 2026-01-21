"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { MssSelector } from "@/components/mss/mss-selector";
import { StoryCard } from "./story-card";
import { updateStoryMss, updateEpicMss } from "@/server/actions/mss";
import { FileText } from "lucide-react";
import { toast } from "sonner";

interface MssServiceArea {
  id: string;
  code: string;
  name: string;
}

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
  mssServiceArea?: MssServiceArea | null;
  _count?: { subtasks: number };
}

interface Epic {
  id: string;
  code: string;
  title: string;
  mssServiceArea?: MssServiceArea | null;
  _count: { stories: number };
  stories: Story[];
}

interface StoriesSectionProps {
  epics: Epic[];
}

export function StoriesSection({ epics }: StoriesSectionProps) {
  const router = useRouter();
  const totalStories = epics.reduce((sum, epic) => sum + epic._count.stories, 0);
  const epicsWithStories = epics.filter(e => e._count.stories > 0).length;

  // Handle MSS change for a story
  const handleStoryMssChange = useCallback(
    async (storyId: string, mssServiceAreaId: string | null) => {
      const result = await updateStoryMss(storyId, mssServiceAreaId);
      if (result.success) {
        toast.success("Story MSS updated");
        router.refresh();
      } else {
        toast.error("Failed to update story MSS", {
          description: result.error,
        });
      }
    },
    [router]
  );

  // Handle MSS change for an epic (in the header)
  const handleEpicMssChange = useCallback(
    async (epicId: string, mssServiceAreaId: string | null) => {
      const result = await updateEpicMss(epicId, mssServiceAreaId);
      if (result.success) {
        toast.success("Epic MSS updated");
        router.refresh();
      } else {
        toast.error("Failed to update epic MSS", {
          description: result.error,
        });
      }
    },
    [router]
  );

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
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge variant="outline">{epic.code}</Badge>
                {epic.title}
              </CardTitle>
              <MssSelector
                value={epic.mssServiceArea?.id ?? null}
                onSelect={(id) => handleEpicMssChange(epic.id, id)}
              />
            </div>
            <CardDescription>{epic._count.stories} stories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {epic.stories.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  epicMssServiceArea={epic.mssServiceArea}
                  onMssChange={handleStoryMssChange}
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
