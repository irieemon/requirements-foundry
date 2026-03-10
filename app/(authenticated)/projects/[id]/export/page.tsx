import { notFound } from "next/navigation";
import { getProjectForExport } from "@/server/actions/jira-export";
import { PageHeader } from "@/components/layout/page-header";
import { ExportWizard } from "@/components/export/export-wizard";

interface ExportPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExportPage({ params }: ExportPageProps) {
  const { id } = await params;

  let project;
  try {
    project = await getProjectForExport(id);
  } catch {
    notFound();
  }

  if (!project) {
    notFound();
  }

  // Check if there are any epics to export
  const hasEpics = project._count.epics > 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <PageHeader
        title="Export to Jira"
        description={`Export ${project.name} to Jira-compatible CSV format`}
        backHref={`/projects/${project.id}`}
        backLabel="Back to project"
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {hasEpics ? (
            <ExportWizard
              projectId={project.id}
              projectName={project.name}
              initialEpicCount={project._count.epics}
            />
          ) : (
            <div className="text-center py-16">
              <h2 className="text-lg font-semibold mb-2">No Epics to Export</h2>
              <p className="text-muted-foreground mb-4">
                Generate some epics first, then come back to export them to Jira.
              </p>
              <a
                href={`/projects/${project.id}`}
                className="text-primary hover:underline"
              >
                Go back to project
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
