import { notFound } from "next/navigation";
import { getEpic } from "@/server/actions/epics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateStoriesForm } from "@/components/stories/generate-stories-form";
import { StoryTable } from "@/components/stories/story-table";
import { SubtaskGenerationSection } from "@/components/subtasks/subtask-generation-section";
import { ExportEpicButton } from "@/components/export/export-buttons";
import { PageHeader } from "@/components/layout/page-header";
import { BookOpen } from "lucide-react";

interface EpicPageProps {
  params: Promise<{ id: string; epicId: string }>;
}

export default async function EpicPage({ params }: EpicPageProps) {
  const { id, epicId } = await params;
  const epic = await getEpic(epicId);

  if (!epic || epic.projectId !== id) {
    notFound();
  }

  const acceptanceCriteria = epic.acceptanceCriteria
    ? JSON.parse(epic.acceptanceCriteria)
    : [];
  const dependencies = epic.dependencies ? JSON.parse(epic.dependencies) : [];

  const getImpactColor = (impact: string | null) => {
    switch (impact?.toLowerCase()) {
      case "high":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "medium":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-gray-500/10 text-gray-700 border-gray-200";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-3 py-1">
              {epic.code}
            </Badge>
            <span>{epic.title}</span>
          </div>
        }
        description={epic.theme || undefined}
        backHref={`/projects/${id}`}
        backLabel="Back to project"
        actions={<ExportEpicButton epicId={epic.id} projectId={id} />}
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Epic Details */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              {epic.description && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{epic.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Business Value */}
              {epic.businessValue && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Business Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{epic.businessValue}</p>
                  </CardContent>
                </Card>
              )}

              {/* Acceptance Criteria */}
              {acceptanceCriteria.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-base">Acceptance Criteria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {acceptanceCriteria.map((ac: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {ac}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {epic.impact && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Impact</span>
                      <Badge variant="outline" className={getImpactColor(epic.impact)}>
                        {epic.impact}
                      </Badge>
                    </div>
                  )}
                  {epic.effort && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Effort</span>
                      <Badge variant="secondary">{epic.effort}</Badge>
                    </div>
                  )}
                  {epic.priority !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Priority</span>
                      <Badge variant="outline">#{epic.priority}</Badge>
                    </div>
                  )}
                  {dependencies.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">Dependencies</span>
                      <div className="flex flex-wrap gap-1">
                        {dependencies.map((dep: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    <BookOpen className="mr-1.5 h-4 w-4" />
                    Stories
                  </CardTitle>
                  <CardDescription>{epic.stories.length} stories generated</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Story Generation */}
          <GenerateStoriesForm epicId={epic.id} hasExistingStories={epic.stories.length > 0} />

          {/* Stories Table */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>User Stories</CardTitle>
              <CardDescription>
                Generated user stories for this epic. Click a row to expand details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StoryTable stories={epic.stories} />
            </CardContent>
          </Card>

          {/* Subtask Generation */}
          {epic.stories.length > 0 && (
            <SubtaskGenerationSection
              epicId={epic.id}
              projectId={id}
              stories={epic.stories.map(s => ({
                id: s.id,
                code: s.code,
                title: s.title,
                _count: { subtasks: s._count?.subtasks || 0 }
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
