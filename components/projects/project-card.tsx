"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Trash2, FileText, Layers, BookOpen, Activity } from "lucide-react";
import { deleteProject } from "@/server/actions/projects";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ProjectCardProps {
  project: {
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
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/projects/${project.id}`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteProject(project.id);
      toast.success("Project deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete project");
    }
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            {project.name}
          </CardTitle>
          {project.description && (
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            <FileText className="mr-1 h-3 w-3" />
            {project._count.uploads} uploads
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Layers className="mr-1 h-3 w-3" />
            {project._count.cards} cards
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <BookOpen className="mr-1 h-3 w-3" />
            {project._count.epics} epics
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Activity className="mr-1 h-3 w-3" />
            {project._count.runs} runs
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(project.createdAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
