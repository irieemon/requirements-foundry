import { ProjectCard } from "./project-card";
import { EmptyState } from "@/components/layout/empty-state";
import { FolderOpen } from "lucide-react";
import { CreateProjectDialog } from "./create-project-dialog";

interface ProjectListProps {
  projects: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    _count: {
      uploads: number;
      cards: number;
      epics: number;
      runs: number;
    };
  }[];
}

export function ProjectList({ projects }: ProjectListProps) {
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
