import { Suspense } from "react";
import { getAuthorizedProjects } from "@/lib/auth/authorization";
import { ProjectList } from "@/components/projects/project-list";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { AdminViewToggle } from "@/components/projects/admin-view-toggle";
import { PageHeader } from "@/components/layout/page-header";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const viewAll = params.view === "all";
  const { ownedProjects, sharedProjects, user, isAdmin } = await getAuthorizedProjects(viewAll);

  const isAdminViewAll = isAdmin && viewAll;

  // Admin viewAll: annotate with owner email as before
  const adminAnnotatedProjects = isAdminViewAll
    ? ownedProjects.map((project: typeof ownedProjects[number]) => ({
        ...project,
        ownerLabel: project.userId !== user.email ? project.userId : undefined,
      }))
    : undefined;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Projects"
        description="Manage your requirements projects and use case cards."
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Suspense fallback={null}>
                <AdminViewToggle />
              </Suspense>
            )}
            <CreateProjectDialog />
          </div>
        }
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {isAdminViewAll ? (
            <ProjectList projects={adminAnnotatedProjects!} />
          ) : (
            <ProjectList ownedProjects={ownedProjects} sharedProjects={sharedProjects} />
          )}
        </div>
      </div>
    </div>
  );
}
