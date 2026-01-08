"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, BookOpen, FileText, History } from "lucide-react";
import { getEpicsForSelection, getAvailableRuns } from "@/server/actions/jira-export";
import type { ScopeMode, ExportScope, EpicOption, RunOption } from "@/lib/export/jira/client";
import { formatDistanceToNow } from "date-fns";

interface ScopeSelectorProps {
  projectId: string;
  scope: ExportScope;
  onScopeChange: (scope: ExportScope) => void;
}

export function ScopeSelector({ projectId, scope, onScopeChange }: ScopeSelectorProps) {
  const [epics, setEpics] = useState<EpicOption[]>([]);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      try {
        const [epicsData, runsData] = await Promise.all([
          getEpicsForSelection(projectId),
          getAvailableRuns(projectId),
        ]);
        setEpics(epicsData);
        setRuns(runsData);
      } catch (error) {
        console.error("Failed to load scope options:", error);
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, [projectId]);

  const handleModeChange = (mode: ScopeMode) => {
    const newScope: ExportScope = { mode };
    if (mode === "selected") {
      newScope.epicIds = [];
    }
    onScopeChange(newScope);
  };

  const handleEpicToggle = (epicId: string, checked: boolean) => {
    const currentIds = scope.epicIds || [];
    const newIds = checked
      ? [...currentIds, epicId]
      : currentIds.filter((id) => id !== epicId);
    onScopeChange({ ...scope, epicIds: newIds });
  };

  const handleSelectAll = () => {
    onScopeChange({ ...scope, epicIds: epics.map((e) => e.id) });
  };

  const handleSelectNone = () => {
    onScopeChange({ ...scope, epicIds: [] });
  };

  const handleRunChange = (runId: string) => {
    onScopeChange({ ...scope, runId });
  };

  // Calculate summary
  const selectedEpicIds = scope.epicIds || [];
  const selectedEpics = epics.filter((e) => selectedEpicIds.includes(e.id));
  const totalStories = selectedEpics.reduce((sum, e) => sum + e.storyCount, 0);
  const totalSubtasks = selectedEpics.reduce((sum, e) => sum + e.subtaskCount, 0);

  const allStats = {
    epicCount: epics.length,
    storyCount: epics.reduce((sum, e) => sum + e.storyCount, 0),
    subtaskCount: epics.reduce((sum, e) => sum + e.subtaskCount, 0),
  };

  if (loading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Select Scope</CardTitle>
          <CardDescription>Loading export options...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Select Scope
        </CardTitle>
        <CardDescription>
          Choose which epics and stories to include in the export
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scope Mode Selection */}
        <RadioGroup
          value={scope.mode}
          onValueChange={(value) => handleModeChange(value as ScopeMode)}
          className="grid gap-4"
        >
          {/* All Epics */}
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="all" id="scope-all" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="scope-all" className="font-medium cursor-pointer">
                All Epics
              </Label>
              <p className="text-sm text-muted-foreground">
                Export everything: {allStats.epicCount} epics, {allStats.storyCount} stories, {allStats.subtaskCount} subtasks
              </p>
            </div>
          </div>

          {/* Select Epics */}
          <div className="flex items-start space-x-3">
            <RadioGroupItem value="selected" id="scope-selected" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="scope-selected" className="font-medium cursor-pointer">
                Select Epics
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose specific epics to export
              </p>
            </div>
          </div>

          {/* By Run */}
          {runs.length > 0 && (
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="by-run" id="scope-run" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="scope-run" className="font-medium cursor-pointer">
                  By Generation Run
                </Label>
                <p className="text-sm text-muted-foreground">
                  Export items from a specific AI generation run
                </p>
              </div>
            </div>
          )}
        </RadioGroup>

        {/* Epic Selection List */}
        {scope.mode === "selected" && (
          <div className="border border-border/50 rounded-lg">
            <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
              <span className="text-sm font-medium">
                {selectedEpicIds.length} of {epics.length} selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-primary hover:underline"
                >
                  Select all
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-sm text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <ScrollArea className="h-[240px]">
              <div className="p-2 space-y-1">
                {epics.map((epic) => (
                  <label
                    key={epic.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedEpicIds.includes(epic.id)}
                      onCheckedChange={(checked) =>
                        handleEpicToggle(epic.id, checked === true)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {epic.code}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {epic.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {epic.storyCount} stories, {epic.subtaskCount} subtasks
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Run Selection */}
        {scope.mode === "by-run" && (
          <div className="space-y-3">
            <Label>Select Generation Run</Label>
            <Select value={scope.runId || ""} onValueChange={handleRunChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a run..." />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span>
                        {run.type.replace(/_/g, " ")} •{" "}
                        {formatDistanceToNow(run.createdAt, { addSuffix: true })}
                      </span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {run.epicCount} epics
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Summary */}
        <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
          <h4 className="text-sm font-medium mb-3">Export Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">Epics</span>
              </div>
              <p className="text-lg font-semibold">
                {scope.mode === "all"
                  ? allStats.epicCount
                  : scope.mode === "selected"
                  ? selectedEpicIds.length
                  : runs.find((r) => r.id === scope.runId)?.epicCount || 0}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">Stories</span>
              </div>
              <p className="text-lg font-semibold">
                {scope.mode === "all"
                  ? allStats.storyCount
                  : scope.mode === "selected"
                  ? totalStories
                  : runs.find((r) => r.id === scope.runId)?.storyCount || 0}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">Subtasks</span>
              </div>
              <p className="text-lg font-semibold">
                {scope.mode === "all"
                  ? allStats.subtaskCount
                  : scope.mode === "selected"
                  ? totalSubtasks
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
