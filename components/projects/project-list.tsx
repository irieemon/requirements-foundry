import { ProjectCard } from "./project-card";
import { EmptyState } from "@/components/layout/empty-state";
import { FolderOpen } from "lucide-react";
import { CreateProjectDialog } from "./create-project-dialog";

interface ProjectWithMeta {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  ownerLabel?: string;
  role?: string;
  ownerName?: string;
  _count: {
    uploads: number;
    cards: number;
    epics: number;
    runs: number;
  };
}

interface ProjectListProps {
  // Admin viewAll mode: flat list
  projects?: ProjectWithMeta[];
  // Normal mode: split lists
  ownedProjects?: ProjectWithMeta[];
  sharedProjects?: ProjectWithMeta[];
}

export function ProjectList({ projects, ownedProjects, sharedProjects }: ProjectListProps) {
  // Admin viewAll mode: flat list (existing behavior)
  if (projects) {
    if (projects.length === 0) {
      return (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start transforming use cases into requirements."
          action={<CreateProjectDialog />}
        />
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  // Normal mode: two sections
  const owned = ownedProjects || [];
  const shared = sharedProjects || [];

  if (owned.length === 0 && shared.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No projects yet"
        description="Create your first project to start transforming use cases into requirements."
        action={<CreateProjectDialog />}
      />
    );
  }

  return (
    <div className="space-y-8">
      {owned.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">My Projects</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {owned.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
      {shared.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Shared with me</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shared.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
