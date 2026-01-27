"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Layers, LayoutGrid, BookOpen, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MssServiceLineCoverage, MssServiceAreaCoverage } from "@/lib/mss/types";

interface ServiceAreaItemProps {
  area: MssServiceAreaCoverage;
}

function ServiceAreaItem({ area }: ServiceAreaItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasEpics = area.epicCount > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/50 transition-colors",
          hasEpics && "cursor-pointer"
        )}
        disabled={!hasEpics}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-90",
            !hasEpics && "invisible"
          )}
        />
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{area.code}</span>
        <span className="text-sm text-muted-foreground truncate flex-1">
          {area.name}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {area.epicCount}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {area.storyCount}
          </span>
        </div>
      </CollapsibleTrigger>
      {hasEpics && (
        <CollapsibleContent>
          <div className="ml-10 mt-1 mb-2 space-y-1">
            {area.epicTitles.map((title, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground"
              >
                <BookOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{title}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

interface ServiceLineItemProps {
  serviceLine: MssServiceLineCoverage;
}

function ServiceLineItem({ serviceLine }: ServiceLineItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasAreas = serviceLine.serviceAreas.length > 0;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
          <ChevronRight
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
          <Layers className="h-5 w-5 text-primary" />
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{serviceLine.code}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-muted-foreground truncate">
                {serviceLine.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              {serviceLine.totalEpics} epics
            </Badge>
            <Badge variant="outline" className="gap-1">
              <FileText className="h-3 w-3" />
              {serviceLine.totalStories} stories
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-muted/30 px-2 py-2">
            {serviceLine.serviceAreas
              .filter((sa) => sa.epicCount > 0 || sa.storyCount > 0)
              .map((area) => (
                <ServiceAreaItem key={area.id} area={area} />
              ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface MssServiceLineCoverageProps {
  coverage: MssServiceLineCoverage[];
  className?: string;
}

export function MssServiceLineCoverageList({
  coverage,
  className,
}: MssServiceLineCoverageProps) {
  if (coverage.length === 0) {
    return (
      <Card className={cn("p-6", className)}>
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">No MSS Assignments</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No epics or stories have been assigned to MSS service areas yet.
            Assign MSS categories to work items to see coverage here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Coverage by Service Line</h3>
        <Badge variant="outline">{coverage.length} service lines</Badge>
      </div>
      {coverage.map((sl) => (
        <ServiceLineItem key={sl.id} serviceLine={sl} />
      ))}
    </div>
  );
}
