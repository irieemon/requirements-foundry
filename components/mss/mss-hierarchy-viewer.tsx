"use client";

import { Card } from "@/components/ui/card";
import { MssServiceLineItem } from "./mss-service-line-item";
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

  return (
    <div className="space-y-4">
      {/* Summary */}
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

      {/* Hierarchy */}
      <Card className="divide-y overflow-hidden">
        {serviceLines.map((serviceLine) => (
          <MssServiceLineItem key={serviceLine.id} serviceLine={serviceLine} />
        ))}
      </Card>
    </div>
  );
}
