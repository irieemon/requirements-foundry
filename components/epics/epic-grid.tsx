"use client";

import Link from "next/link";
import { EmptyState } from "@/components/layout/empty-state";
import { Sparkles } from "lucide-react";
import { EpicCard, type EpicCardProps } from "./epic-card";

export interface EpicGridProps {
  projectId: string;
  epics: EpicCardProps["epic"][];
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {epics.map((epic) => (
        <Link key={epic.id} href={`/projects/${projectId}/epics/${epic.id}`}>
          <EpicCard epic={epic} />
        </Link>
      ))}
    </div>
  );
}
