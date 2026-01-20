"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronDown, Layers, FileText, CheckSquare } from "lucide-react";
import type { PreviewItem } from "@/lib/export/jira";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface ExportPreviewTreeProps {
  items: PreviewItem[];
  loading?: boolean;
}

interface GroupedItems {
  epics: PreviewItem[];
  storiesByEpic: Map<string, PreviewItem[]>;
  subtasksByStory: Map<string, PreviewItem[]>;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

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

function groupItems(items: PreviewItem[]): GroupedItems {
  const epics: PreviewItem[] = [];
  const storiesByEpic = new Map<string, PreviewItem[]>();
  const subtasksByStory = new Map<string, PreviewItem[]>();

  for (const item of items) {
    if (item.issueType === "Epic") {
      epics.push(item);
    } else if (item.issueType === "Story" && item.parentTempId) {
      const existing = storiesByEpic.get(item.parentTempId) || [];
      existing.push(item);
      storiesByEpic.set(item.parentTempId, existing);
    } else if (item.issueType === "Sub-task" && item.parentTempId) {
      const existing = subtasksByStory.get(item.parentTempId) || [];
      existing.push(item);
      subtasksByStory.set(item.parentTempId, existing);
    }
  }

  return { epics, storiesByEpic, subtasksByStory };
}

// ─────────────────────────────────────────────────────────────────
// Subtask Row (non-expandable)
// ─────────────────────────────────────────────────────────────────

function SubtaskRow({ item }: { item: PreviewItem }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-xs text-muted-foreground hover:bg-muted/30 rounded transition-colors">
      <CheckSquare className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      <Badge variant="outline" className="text-[10px] font-mono shrink-0 px-1.5 py-0">
        {item.code}
      </Badge>
      <span className="truncate flex-1">{item.title}</span>
      {item.effort && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {item.effort}
        </Badge>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Story Row (expandable if has subtasks)
// ─────────────────────────────────────────────────────────────────

function StoryRow({
  item,
  subtasks,
}: {
  item: PreviewItem;
  subtasks: PreviewItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasSubtasks = subtasks.length > 0;

  const trigger = (
    <div
      className={cn(
        "flex items-center gap-2 py-2 px-3 rounded-md",
        "bg-muted/20 hover:bg-muted/40 transition-colors",
        hasSubtasks && "cursor-pointer",
        isOpen && hasSubtasks && "rounded-b-none"
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Badge variant="outline" className="text-xs font-mono shrink-0">
        {item.code}
      </Badge>
      <span className="text-sm truncate flex-1">{item.title}</span>
      {item.priority && (
        <Badge
          variant="outline"
          className={cn("text-xs", getPriorityStyles(item.priority))}
        >
          {item.priority}
        </Badge>
      )}
      {item.effort && (
        <Badge variant="secondary" className="text-xs">
          {item.effort}
        </Badge>
      )}
      {item.subtaskCount && item.subtaskCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {item.subtaskCount} subtask{item.subtaskCount !== 1 ? "s" : ""}
        </Badge>
      )}
      {hasSubtasks && (
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      )}
    </div>
  );

  if (!hasSubtasks) {
    return <div className="ml-4">{trigger}</div>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-4">
      <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 py-1 space-y-0.5 bg-muted/10 rounded-b-md border-x border-b border-border/30">
          {subtasks.map((subtask) => (
            <SubtaskRow key={subtask.tempId} item={subtask} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────────────────────────
// Epic Row (expandable if has stories)
// ─────────────────────────────────────────────────────────────────

function EpicRow({
  item,
  stories,
  subtasksByStory,
}: {
  item: PreviewItem;
  stories: PreviewItem[];
  subtasksByStory: Map<string, PreviewItem[]>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasStories = stories.length > 0;

  const trigger = (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border/40",
        "bg-card hover:border-border hover:shadow-sm transition-all duration-150",
        hasStories && "cursor-pointer",
        isOpen && hasStories && "rounded-b-none border-b-0"
      )}
    >
      <Layers className="h-4 w-4 shrink-0 text-primary" />
      <Badge variant="outline" className="text-xs font-mono shrink-0">
        {item.code}
      </Badge>
      <span className="font-medium text-sm truncate flex-1">{item.title}</span>
      {item.storyCount && item.storyCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {item.storyCount} stor{item.storyCount !== 1 ? "ies" : "y"}
        </Badge>
      )}
      {hasStories && (
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      )}
    </div>
  );

  if (!hasStories) {
    return trigger;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/20 rounded-b-lg border border-t-0 border-border/40 p-2 space-y-1.5">
          {stories.map((story) => (
            <StoryRow
              key={story.tempId}
              item={story}
              subtasks={subtasksByStory.get(story.tempId) || []}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────────

function TreeSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg border border-border/40 bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

export function ExportPreviewTree({ items, loading = false }: ExportPreviewTreeProps) {
  const grouped = useMemo(() => groupItems(items), [items]);

  if (loading) {
    return <TreeSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No items to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.epics.map((epic) => (
        <EpicRow
          key={epic.tempId}
          item={epic}
          stories={grouped.storiesByEpic.get(epic.tempId) || []}
          subtasksByStory={grouped.subtasksByStory}
        />
      ))}
    </div>
  );
}
