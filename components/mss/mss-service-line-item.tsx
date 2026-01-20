"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceLineWithChildren } from "./mss-hierarchy-viewer";
import type { MssServiceArea, MssActivity } from "@prisma/client";

interface MssServiceLineItemProps {
  serviceLine: ServiceLineWithChildren;
}

export function MssServiceLineItem({ serviceLine }: MssServiceLineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = serviceLine.serviceAreas.length > 0;

  return (
    <div>
      {/* L2 Row */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors",
          hasChildren && "cursor-pointer"
        )}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand toggle */}
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </div>

        {/* Code badge */}
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs shrink-0">
          {serviceLine.code}
        </span>

        {/* Name and description */}
        <div className="flex-1 min-w-0">
          <span className="font-semibold">{serviceLine.name}</span>
          {serviceLine.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 text-sm text-muted-foreground truncate">
                    — {serviceLine.description}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  {serviceLine.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Child count */}
        <span className="text-xs text-muted-foreground shrink-0">
          {serviceLine.serviceAreas.length} areas
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* L3 Children */}
      {isExpanded && serviceLine.serviceAreas.length > 0 && (
        <div className="border-t border-border/50">
          {serviceLine.serviceAreas.map((serviceArea) => (
            <ServiceAreaItem
              key={serviceArea.id}
              serviceArea={serviceArea}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ServiceAreaItemProps {
  serviceArea: MssServiceArea & { activities: MssActivity[] };
}

function ServiceAreaItem({ serviceArea }: ServiceAreaItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = serviceArea.activities.length > 0;

  return (
    <div>
      {/* L3 Row */}
      <div
        className={cn(
          "flex items-center gap-2 pl-8 pr-4 py-2.5 hover:bg-muted/50 transition-colors bg-muted/20",
          hasChildren && "cursor-pointer"
        )}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand toggle */}
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          )}
        </div>

        {/* Code badge */}
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs shrink-0">
          {serviceArea.code}
        </span>

        {/* Name and description */}
        <div className="flex-1 min-w-0">
          <span className="font-medium">{serviceArea.name}</span>
          {serviceArea.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 text-sm text-muted-foreground truncate">
                    — {serviceArea.description}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  {serviceArea.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Child count */}
        <span className="text-xs text-muted-foreground shrink-0">
          {serviceArea.activities.length} activities
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* L4 Children */}
      {isExpanded && serviceArea.activities.length > 0 && (
        <div className="border-t border-border/30">
          {serviceArea.activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ActivityItemProps {
  activity: MssActivity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-2 pl-16 pr-4 py-2 hover:bg-muted/50 transition-colors bg-muted/30">
      {/* Spacer for alignment */}
      <div className="w-5 h-5 shrink-0" />

      {/* Code badge */}
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs shrink-0">
        {activity.code}
      </span>

      {/* Name and description */}
      <div className="flex-1 min-w-0">
        <span>{activity.name}</span>
        {activity.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-2 text-sm text-muted-foreground truncate">
                  — {activity.description}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-md">
                {activity.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
