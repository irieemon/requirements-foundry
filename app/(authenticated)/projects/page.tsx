import { getProjects } from "@/server/actions/projects";
import { ProjectList } from "@/components/projects/project-list";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { PageHeader } from "@/components/layout/page-header";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Projects"
        description="Manage your requirements projects and use case cards."
        actions={<CreateProjectDialog />}
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <ProjectList projects={projects} />
        </div>
      </div>
    </div>
  );
}
