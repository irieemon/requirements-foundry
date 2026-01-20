"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SubtaskCardProps {
  subtask: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    effort: string | null;
  };
}

export function SubtaskCard({ subtask }: SubtaskCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDescription = Boolean(subtask.description);

  // If no description, render static card (not expandable)
  if (!hasDescription) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-md border border-border/40 bg-card hover:bg-muted/30 transition-colors">
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          {subtask.code}
        </Badge>
        <span className="flex-1 text-sm truncate">{subtask.title}</span>
        {subtask.effort && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {subtask.effort}
          </Badge>
        )}
      </div>
    );
  }

  // With description: render collapsible card
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-3 py-2 px-3 rounded-md border border-border/40 bg-card",
            "hover:bg-muted/30 transition-colors cursor-pointer",
            isOpen && "rounded-b-none border-b-0"
          )}
        >
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {subtask.code}
          </Badge>
          <span className="flex-1 text-sm truncate">{subtask.title}</span>
          {subtask.effort && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {subtask.effort}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 py-2 text-sm text-muted-foreground bg-muted/20 rounded-b-md border border-t-0 border-border/40">
          {subtask.description}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
