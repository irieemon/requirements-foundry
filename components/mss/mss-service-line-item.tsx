"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceLineWithChildren } from "./mss-hierarchy-viewer";
import type { MssServiceArea, MssActivity } from "@prisma/client";
import { MssEntryDialog } from "./mss-entry-dialog";
import { MssEditDialog } from "./mss-edit-dialog";
import { MssDeleteDialog } from "./mss-delete-dialog";

interface MssServiceLineItemProps {
  serviceLine: ServiceLineWithChildren;
  onRefresh: () => void;
}

export function MssServiceLineItem({ serviceLine, onRefresh }: MssServiceLineItemProps) {
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
        <div className="flex-1 min-w-0 truncate">
          <span className="font-semibold">{serviceLine.name}</span>
          {serviceLine.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 text-sm text-muted-foreground">
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
          <MssEntryDialog
            level="L3"
            parentId={serviceLine.id}
            parentName={serviceLine.name}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
          <MssEditDialog
            level="L2"
            item={{
              id: serviceLine.id,
              code: serviceLine.code,
              name: serviceLine.name,
              description: serviceLine.description,
            }}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
          <MssDeleteDialog
            level="L2"
            item={{
              id: serviceLine.id,
              code: serviceLine.code,
              name: serviceLine.name,
            }}
            cascadeInfo={{
              serviceAreaCount: serviceLine.serviceAreas.length,
              activityCount: serviceLine.serviceAreas.reduce(
                (sum, sa) => sum + sa.activities.length,
                0
              ),
            }}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
        </div>
      </div>

      {/* L3 Children */}
      {isExpanded && serviceLine.serviceAreas.length > 0 && (
        <div className="border-t border-border/50">
          {serviceLine.serviceAreas.map((serviceArea) => (
            <ServiceAreaItem
              key={serviceArea.id}
              serviceArea={serviceArea}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ServiceAreaItemProps {
  serviceArea: MssServiceArea & { activities: MssActivity[] };
  onRefresh: () => void;
}

function ServiceAreaItem({ serviceArea, onRefresh }: ServiceAreaItemProps) {
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
        <div className="flex-1 min-w-0 truncate">
          <span className="font-medium">{serviceArea.name}</span>
          {serviceArea.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-2 text-sm text-muted-foreground">
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
          <MssEntryDialog
            level="L4"
            parentId={serviceArea.id}
            parentName={serviceArea.name}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
          <MssEditDialog
            level="L3"
            item={{
              id: serviceArea.id,
              code: serviceArea.code,
              name: serviceArea.name,
              description: serviceArea.description,
            }}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
          <MssDeleteDialog
            level="L3"
            item={{
              id: serviceArea.id,
              code: serviceArea.code,
              name: serviceArea.name,
            }}
            cascadeInfo={{
              activityCount: serviceArea.activities.length,
            }}
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
            onSuccess={onRefresh}
          />
        </div>
      </div>

      {/* L4 Children */}
      {isExpanded && serviceArea.activities.length > 0 && (
        <div className="border-t border-border/30">
          {serviceArea.activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ActivityItemProps {
  activity: MssActivity;
  onRefresh: () => void;
}

function ActivityItem({ activity, onRefresh }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-2 pl-16 pr-4 py-2 hover:bg-muted/50 transition-colors bg-muted/30">
      {/* Spacer for alignment */}
      <div className="w-5 h-5 shrink-0" />

      {/* Code badge */}
      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs shrink-0">
        {activity.code}
      </span>

      {/* Name and description */}
      <div className="flex-1 min-w-0 truncate">
        <span>{activity.name}</span>
        {activity.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-2 text-sm text-muted-foreground">
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
        <MssEditDialog
          level="L4"
          item={{
            id: activity.id,
            code: activity.code,
            name: activity.name,
            description: activity.description,
          }}
          trigger={
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
          onSuccess={onRefresh}
        />
        <MssDeleteDialog
          level="L4"
          item={{
            id: activity.id,
            code: activity.code,
            name: activity.name,
          }}
          trigger={
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          }
          onSuccess={onRefresh}
        />
      </div>
    </div>
  );
}
