"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { BookOpen, ArrowRight, Sparkles } from "lucide-react";

export interface EpicGridProps {
  projectId: string;
  epics: {
    id: string;
    code: string;
    title: string;
    theme: string | null;
    description: string | null;
    effort: string | null;
    impact: string | null;
    priority: number | null;
    _count: {
      stories: number;
    };
  }[];
}

export function EpicGrid({ projectId, epics }: EpicGridProps) {
  if (epics.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No epics yet"
        description="Generate epics from your use case cards to organize them into deliverable features."
        compact
      />
    );
  }

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

  const getEffortLabel = (effort: string | null) => {
    switch (effort?.toUpperCase()) {
      case "S":
        return "Small";
      case "M":
        return "Medium";
      case "L":
        return "Large";
      default:
        return effort;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {epics.map((epic) => (
        <Link key={epic.id} href={`/projects/${projectId}/epics/${epic.id}`}>
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <Badge variant="outline" className="mb-2">
                  {epic.code}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <CardTitle className="text-base line-clamp-2">{epic.title}</CardTitle>
              {epic.theme && (
                <CardDescription className="text-xs">{epic.theme}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {epic.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {epic.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {epic.impact && (
                  <Badge variant="outline" className={getImpactColor(epic.impact)}>
                    {epic.impact} impact
                  </Badge>
                )}
                {epic.effort && (
                  <Badge variant="secondary" className="text-xs">
                    {getEffortLabel(epic.effort)}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  <BookOpen className="mr-1 h-3 w-3" />
                  {epic._count.stories} stories
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
