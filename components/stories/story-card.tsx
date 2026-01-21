"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MssSelector } from "@/components/mss/mss-selector";
import { cn } from "@/lib/utils";
import { ChevronDown, ListTodo, User } from "lucide-react";

interface MssServiceArea {
  id: string;
  code: string;
  name: string;
}

export interface StoryCardProps {
  story: {
    id: string;
    code: string;
    title: string;
    userStory: string;
    persona: string | null;
    acceptanceCriteria: string | null;
    technicalNotes: string | null;
    priority: string | null;
    effort: string | null;
    mssServiceArea?: MssServiceArea | null;
  };
  /** Epic's MSS service area (for inheritance display) */
  epicMssServiceArea?: MssServiceArea | null;
  /** Callback when MSS assignment changes */
  onMssChange?: (storyId: string, mssServiceAreaId: string | null) => void;
  subtaskCount?: number;
}

function getPriorityStyles(priority: string | null): string {
  switch (priority?.toLowerCase()) {
    case "must":
      return "text-red-600 bg-red-50 border-red-200";
    case "should":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "could":
      return "text-blue-600 bg-blue-50 border-blue-200";
    case "won't":
      return "text-slate-600 bg-slate-100 border-slate-200";
    default:
      return "";
  }
}

function parseAcceptanceCriteria(ac: string | null): string[] {
  if (!ac) return [];
  try {
    return JSON.parse(ac);
  } catch {
    return [ac];
  }
}

export function StoryCard({
  story,
  epicMssServiceArea,
  onMssChange,
  subtaskCount = 0,
}: StoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const criteria = parseAcceptanceCriteria(story.acceptanceCriteria);

  // Determine effective MSS (story's own or inherited from epic)
  const effectiveMssId = story.mssServiceArea?.id ?? epicMssServiceArea?.id ?? null;
  // Check if story has its own MSS that differs from epic
  const hasOwnMss = story.mssServiceArea !== null && story.mssServiceArea !== undefined;
  const isOverridden = hasOwnMss && epicMssServiceArea && story.mssServiceArea?.id !== epicMssServiceArea.id;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "rounded-lg border border-border/40 bg-card p-4",
            "hover:border-border hover:shadow-sm transition-all duration-150",
            "cursor-pointer",
            isOpen && "rounded-b-none border-b-0"
          )}
        >
          {/* Header row: Code + Title + Priority + Effort */}
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs font-mono shrink-0">
              {story.code}
            </Badge>

            <div className="flex-grow min-w-0">
              <h4 className="font-medium text-sm leading-snug">
                {story.title}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {story.userStory}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {story.priority && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", getPriorityStyles(story.priority))}
                >
                  {story.priority}
                </Badge>
              )}
              {story.effort && (
                <Badge variant="secondary" className="text-xs">
                  {story.effort}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </div>

          {/* Secondary row: Persona tag + Subtask count + MSS */}
          <div className="flex items-center gap-2 mt-2 pl-[52px]">
            {story.persona && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <User className="mr-1 h-3 w-3" />
                {story.persona}
              </Badge>
            )}
            {subtaskCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                <ListTodo className="mr-1 h-3 w-3" />
                {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
              </Badge>
            )}
            <div className={cn("flex items-center gap-1", isOverridden && "ring-1 ring-primary/30 rounded-full")}>
              <MssSelector
                value={effectiveMssId}
                onSelect={(id) => onMssChange?.(story.id, id)}
                disabled={!onMssChange}
              />
            </div>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div
          className={cn(
            "bg-muted/30 rounded-b-lg px-4 py-3 border border-t-0 border-border/40",
            "space-y-3"
          )}
        >
          {/* Full user story */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              User Story
            </p>
            <p className="text-sm">{story.userStory}</p>
          </div>

          {/* Acceptance criteria */}
          {criteria.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Acceptance Criteria
              </p>
              <ul className="list-disc list-inside space-y-1">
                {criteria.map((criterion, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical notes */}
          {story.technicalNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Technical Notes
              </p>
              <p className="text-sm text-muted-foreground">
                {story.technicalNotes}
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
