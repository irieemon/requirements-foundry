import { notFound } from "next/navigation";
import { getProject } from "@/server/actions/projects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStrip } from "@/components/ui/kpi-card";
import { NavigableKpiCard } from "@/components/ui/navigable-kpi-card";
import { TextPasteDialog } from "@/components/uploads/text-paste-dialog";
import { MultiFileUpload } from "@/components/uploads/multi-file-upload";
import { UploadList } from "@/components/uploads/upload-list";
import { AnalyzePanel } from "@/components/analysis/analyze-panel";
import { EpicsSection } from "@/components/epics/epics-section";
import { RunList } from "@/components/runs/run-list";
import { ExportProjectButton } from "@/components/export/export-buttons";
import { EmptyState } from "@/components/layout/empty-state";
import { Layers } from "lucide-react";

type Section = "uploads" | "cards" | "epics" | "runs";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params;
  const { section: sectionParam } = await searchParams;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  // Validate and default the section
  const validSections: Section[] = ["uploads", "cards", "epics", "runs"];
  const activeSection: Section = validSections.includes(sectionParam as Section)
    ? (sectionParam as Section)
    : "uploads";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <PageHeader
        title={project.name}
        description={project.description || undefined}
        backHref="/projects"
        backLabel="Back to projects"
        actions={<ExportProjectButton projectId={project.id} hasEpics={project._count.epics > 0} />}
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI Navigation Strip */}
        <KpiStrip>
          <NavigableKpiCard
            label="Uploads"
            value={project._count.uploads}
            iconName="FileText"
            section="uploads"
            projectId={project.id}
          />
          <NavigableKpiCard
            label="Cards"
            value={project._count.cards}
            iconName="Layers"
            section="cards"
            projectId={project.id}
          />
          <NavigableKpiCard
            label="Epics"
            value={project._count.epics}
            iconName="BookOpen"
            section="epics"
            projectId={project.id}
          />
          <NavigableKpiCard
            label="Runs"
            value={project._count.runs}
            iconName="Activity"
            section="runs"
            projectId={project.id}
          />
        </KpiStrip>

        {/* Section Content */}
        <div className="space-y-6">
          {/* Uploads Section */}
          {activeSection === "uploads" && (
            <>
              {/* Upload Section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Add Documents</CardTitle>
                  <CardDescription>
                    Upload files or paste text. Documents will be extracted but not analyzed until you run the AI.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <TextPasteDialog projectId={project.id} />
                  </div>
                  <MultiFileUpload projectId={project.id} />
                </CardContent>
              </Card>

              {/* Analysis Section */}
              {project.uploads.length > 0 && (
                <AnalyzePanel projectId={project.id} uploads={project.uploads} />
              )}

              {/* Upload History */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Upload History</CardTitle>
                </CardHeader>
                <CardContent>
                  <UploadList uploads={project.uploads} />
                </CardContent>
              </Card>
            </>
          )}

          {/* Cards Section */}
          {activeSection === "cards" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Extracted Cards</CardTitle>
                <CardDescription>
                  Use case cards extracted from your uploads.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {project.cards.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="No cards yet"
                    description="Upload content and run the AI analyzer to extract use case cards."
                    compact
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {project.cards.map((card) => (
                      <Card key={card.id} className="border-border/50 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold line-clamp-2">
                            {card.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                          {card.problem && (
                            <p className="line-clamp-2">
                              <span className="font-medium text-foreground">Problem:</span> {card.problem}
                            </p>
                          )}
                          {card.targetUsers && (
                            <p>
                              <span className="font-medium text-foreground">Users:</span> {card.targetUsers}
                            </p>
                          )}
                          {card.priority && (
                            <Badge variant="outline" className="mt-1">
                              {card.priority}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Epics Section */}
          {activeSection === "epics" && (
            <EpicsSection
              projectId={project.id}
              epics={project.epics}
              cardCount={project._count.cards}
            />
          )}

          {/* Runs Section */}
          {activeSection === "runs" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Generation Runs</CardTitle>
                <CardDescription>History of AI generation tasks for this project.</CardDescription>
              </CardHeader>
              <CardContent>
                <RunList runs={project.runs} />
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
