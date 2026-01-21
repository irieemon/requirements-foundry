"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { MssServiceLineItem } from "./mss-service-line-item";
import { MssEntryDialog } from "./mss-entry-dialog";
import type { MssServiceLine, MssServiceArea, MssActivity } from "@prisma/client";

export type ServiceLineWithChildren = MssServiceLine & {
  serviceAreas: (MssServiceArea & {
    activities: MssActivity[];
  })[];
};

interface MssHierarchyViewerProps {
  serviceLines: ServiceLineWithChildren[];
}

export function MssHierarchyViewer({ serviceLines }: MssHierarchyViewerProps) {
  const router = useRouter();
  // Calculate totals
  const totalServiceLines = serviceLines.length;
  const totalServiceAreas = serviceLines.reduce(
    (sum, sl) => sum + sl.serviceAreas.length,
    0
  );
  const totalActivities = serviceLines.reduce(
    (sum, sl) =>
      sum + sl.serviceAreas.reduce((aSum, sa) => aSum + sa.activities.length, 0),
    0
  );

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Header with summary and add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{totalServiceLines}</strong> Service Lines
          </span>
          <span>•</span>
          <span>
            <strong className="text-foreground">{totalServiceAreas}</strong> Service Areas
          </span>
          <span>•</span>
          <span>
            <strong className="text-foreground">{totalActivities}</strong> Activities
          </span>
        </div>
        <MssEntryDialog
          level="L2"
          trigger={
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Service Line
            </Button>
          }
          onSuccess={handleRefresh}
        />
      </div>

      {/* Hierarchy */}
      <Card className="divide-y overflow-hidden">
        {serviceLines.map((serviceLine) => (
          <MssServiceLineItem
            key={serviceLine.id}
            serviceLine={serviceLine}
            onRefresh={handleRefresh}
          />
        ))}
      </Card>
    </div>
  );
}
