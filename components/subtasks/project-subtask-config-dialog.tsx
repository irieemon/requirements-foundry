"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListTodo, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { startGenerateSubtasks } from "@/server/actions/subtasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  GenerationMode,
  ExistingStoriesBehavior,
  ProcessingPacing,
  GENERATION_MODE_CONFIG,
} from "@/lib/types";

// ============================================
// Types
// ============================================

interface Story {
  id: string;
  code: string;
  title: string;
  _count?: { subtasks: number };
}

interface Epic {
  id: string;
  code: string;
  title: string;
  stories: Story[];
}

interface ProjectSubtaskConfigDialogProps {
  projectId: string;
  epics: Epic[];
  onStarted?: (runId: string) => void;
  trigger?: React.ReactNode;
}

// Mode descriptions
const SUBTASK_MODE_DESCRIPTIONS: Record<GenerationMode, string> = {
  compact: "3-5 subtasks per story, core implementation tasks only",
  standard: "5-8 subtasks per story, includes testing and documentation",
  detailed: "8-12 subtasks per story, comprehensive breakdown with edge cases",
};

// ============================================
// Main Dialog Component
// ============================================

export function ProjectSubtaskConfigDialog({
  projectId,
  epics,
  onStarted,
  trigger,
}: ProjectSubtaskConfigDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Expanded epic sections
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  // Flatten all stories with epic context
  const allStories = useMemo(() =>
    epics.flatMap(epic =>
      epic.stories.map(story => ({ ...story, epicId: epic.id, epicCode: epic.code }))
    ),
    [epics]
  );

  // Configuration state
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>(
    allStories.map((s) => s.id)
  );
  const [existingBehavior, setExistingBehavior] = useState<ExistingStoriesBehavior>(
    ExistingStoriesBehavior.SKIP
  );
  const [mode, setMode] = useState<GenerationMode>("standard");

  // Derived values
  const storiesWithSubtasks = allStories.filter((s) => (s._count?.subtasks || 0) > 0);
  const selectedStories = allStories.filter((s) => selectedStoryIds.includes(s.id));
  const allSelected = selectedStoryIds.length === allStories.length;

  // Toggle epic expansion
  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSelectedStoryIds(allStories.map((s) => s.id));
      setExistingBehavior(ExistingStoriesBehavior.SKIP);
      setMode("standard");
      setExpandedEpics(new Set());
    }
  };

  const handleToggleStory = (storyId: string) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId]
    );
  };

  const handleToggleEpicStories = (epicId: string) => {
    const epicStoryIds = allStories.filter(s => s.epicId === epicId).map(s => s.id);
    const allEpicStoriesSelected = epicStoryIds.every(id => selectedStoryIds.includes(id));

    if (allEpicStoriesSelected) {
      setSelectedStoryIds(prev => prev.filter(id => !epicStoryIds.includes(id)));
    } else {
      setSelectedStoryIds(prev => [...new Set([...prev, ...epicStoryIds])]);
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedStoryIds([]);
    } else {
      setSelectedStoryIds(allStories.map((s) => s.id));
    }
  };

  const handleStart = async () => {
    if (selectedStoryIds.length === 0) {
      toast.error("Please select at least one story");
      return;
    }

    setIsLoading(true);
    try {
      // Group selected stories by epic
      const storiesByEpic = new Map<string, string[]>();
      for (const story of allStories.filter(s => selectedStoryIds.includes(s.id))) {
        const existing = storiesByEpic.get(story.epicId) || [];
        storiesByEpic.set(story.epicId, [...existing, story.id]);
      }

      // Start generation for the first epic (run engine handles sequential processing)
      // For now, we process one epic at a time - could be enhanced to batch
      const [firstEpicId, firstStoryIds] = [...storiesByEpic.entries()][0];

      const result = await startGenerateSubtasks({
        epicId: firstEpicId,
        storyIds: firstStoryIds,
        options: {
          mode,
          existingSubtasksBehavior: existingBehavior,
          pacing: "normal" as ProcessingPacing,
        },
      });

      if (result.success && result.runId) {
        const epicCount = storiesByEpic.size;
        if (epicCount > 1) {
          toast.success(
            `Started subtask generation for ${selectedStoryIds.length} stories. ` +
            `Note: Processing first epic (${firstStoryIds.length} stories). ` +
            `Other epics can be processed after completion.`
          );
        } else {
          toast.success(`Started generating subtasks for ${result.storyCount} stories`);
        }
        handleOpenChange(false);
        onStarted?.(result.runId);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to start generation");
      }
    } catch (error) {
      console.error("Failed to start subtask generation:", error);
      toast.error("Failed to start subtask generation");
    } finally {
      setIsLoading(false);
    }
  };

  // Estimate subtask counts
  const modeConfig = GENERATION_MODE_CONFIG[mode];
  const avgSubtasksPerStory = (modeConfig.storyCount.min + modeConfig.storyCount.max) / 2;
  const estimatedSubtasks = Math.round(selectedStories.length * avgSubtasksPerStory);

  const hasStories = allStories.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" size="sm" disabled={!hasStories}>
            <ListTodo className="h-4 w-4 mr-2" />
            Generate Subtasks
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Generate Subtasks
          </DialogTitle>
          <DialogDescription>
            Break down user stories into implementable subtasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Story Selection by Epic */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Stories to process</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                className="h-auto py-1 px-2 text-xs"
              >
                {allSelected ? "Deselect All" : `Select All (${allStories.length})`}
              </Button>
            </div>
            <ScrollArea className="h-[220px] border rounded-lg">
              <div className="p-3 space-y-2">
                {epics.map((epic) => {
                  const epicStories = allStories.filter(s => s.epicId === epic.id);
                  const selectedCount = epicStories.filter(s => selectedStoryIds.includes(s.id)).length;
                  const allEpicSelected = selectedCount === epicStories.length;
                  const isExpanded = expandedEpics.has(epic.id);

                  return (
                    <div key={epic.id} className="space-y-1">
                      {/* Epic header */}
                      <div
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-md transition-colors",
                          "hover:bg-muted/50 cursor-pointer",
                          allEpicSelected && "bg-primary/5"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleEpic(epic.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <Checkbox
                          checked={allEpicSelected}
                          onCheckedChange={() => handleToggleEpicStories(epic.id)}
                        />
                        <div className="flex-1 min-w-0" onClick={() => toggleEpic(epic.id)}>
                          <p className="text-sm font-medium truncate">
                            <Badge variant="outline" className="mr-2 font-mono">
                              {epic.code}
                            </Badge>
                            {epic.title}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {selectedCount}/{epicStories.length}
                        </Badge>
                      </div>

                      {/* Stories within epic */}
                      {isExpanded && (
                        <div className="ml-6 space-y-1 border-l pl-3">
                          {epicStories.map((story) => (
                            <label
                              key={story.id}
                              className={cn(
                                "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                                "hover:bg-muted/50",
                                selectedStoryIds.includes(story.id) && "bg-primary/5"
                              )}
                            >
                              <Checkbox
                                checked={selectedStoryIds.includes(story.id)}
                                onCheckedChange={() => handleToggleStory(story.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">
                                  <Badge variant="outline" className="mr-2 font-mono text-xs">
                                    {story.code}
                                  </Badge>
                                  {story.title}
                                </p>
                              </div>
                              {(story._count?.subtasks || 0) > 0 && (
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  {story._count?.subtasks} existing
                                </Badge>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {selectedStoryIds.length} of {allStories.length} stories selected across {epics.length} epics
            </p>
          </div>

          {/* Existing Subtasks Behavior */}
          {storiesWithSubtasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <Label className="text-base font-medium">
                  {storiesWithSubtasks.length} story(s) already have subtasks
                </Label>
              </div>
              <RadioGroup
                value={existingBehavior}
                onValueChange={(v) => setExistingBehavior(v as ExistingStoriesBehavior)}
                className="grid gap-2"
              >
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    existingBehavior === ExistingStoriesBehavior.SKIP && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value={ExistingStoriesBehavior.SKIP} />
                  <div>
                    <p className="font-medium text-sm">Skip existing</p>
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t regenerate subtasks for stories that already have them
                    </p>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    existingBehavior === ExistingStoriesBehavior.REPLACE && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value={ExistingStoriesBehavior.REPLACE} />
                  <div>
                    <p className="font-medium text-sm">Replace existing</p>
                    <p className="text-xs text-muted-foreground">
                      Delete existing subtasks and regenerate fresh ones
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Generation mode</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as GenerationMode)}
              className="grid gap-2"
            >
              {(["compact", "standard", "detailed"] as const).map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    mode === m && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem value={m} />
                  <div>
                    <p className="font-medium text-sm capitalize">{m}</p>
                    <p className="text-xs text-muted-foreground">
                      {SUBTASK_MODE_DESCRIPTIONS[m]}
                    </p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            <p>{selectedStories.length} stories selected</p>
            <p className="text-xs">~{estimatedSubtasks} subtasks estimated</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={isLoading || selectedStoryIds.length === 0}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start Generation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
