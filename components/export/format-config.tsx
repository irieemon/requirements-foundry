"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings2,
  Cloud,
  Server,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { previewExport } from "@/server/actions/jira-export";
import type {
  JiraPreset,
  ContentLevel,
  ExportConfig,
  ExportScope,
  JiraExportRow,
} from "@/lib/export/jira/client";
import { getAllPresets } from "@/lib/export/jira/client";

interface FormatConfigProps {
  projectId: string;
  scope: ExportScope;
  config: {
    preset: JiraPreset;
    contentLevel: ContentLevel;
    includeSubtasks: boolean;
  };
  onConfigChange: (config: {
    preset: JiraPreset;
    contentLevel: ContentLevel;
    includeSubtasks: boolean;
  }) => void;
  subtaskCount: number;
}

const presetIcons: Record<JiraPreset, React.ReactNode> = {
  "cloud-company": <Cloud className="h-4 w-4" aria-hidden="true" />,
  "cloud-team": <Users className="h-4 w-4" aria-hidden="true" />,
  "server-dc": <Server className="h-4 w-4" aria-hidden="true" />,
};

export function FormatConfig({
  projectId,
  scope,
  config,
  onConfigChange,
  subtaskCount,
}: FormatConfigProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<JiraExportRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const presets = getAllPresets();

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const fullConfig: ExportConfig = {
        scope,
        preset: config.preset,
        contentLevel: config.contentLevel,
        includeSubtasks: config.includeSubtasks,
      };
      const result = await previewExport(projectId, fullConfig);
      setPreviewData(result.sampleRows);
    } catch (error) {
      console.error("Failed to load preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (previewOpen) {
      loadPreview();
    }
  }, [previewOpen, config.preset, config.contentLevel, config.includeSubtasks]);

  const handlePresetChange = (preset: JiraPreset) => {
    onConfigChange({ ...config, preset });
  };

  const handleContentLevelChange = (level: ContentLevel) => {
    onConfigChange({ ...config, contentLevel: level });
  };

  const handleSubtasksChange = (include: boolean) => {
    onConfigChange({ ...config, includeSubtasks: include });
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Format Options
        </CardTitle>
        <CardDescription>
          Configure how your data will be formatted for Jira import
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Jira Preset Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Jira Target</Label>
          <RadioGroup
            value={config.preset}
            onValueChange={(value) => handlePresetChange(value as JiraPreset)}
            className="grid gap-3"
          >
            {presets.map((preset) => (
              <label
                key={preset.name}
                className="flex items-start gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem
                  value={preset.name}
                  id={`preset-${preset.name}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {presetIcons[preset.name as JiraPreset]}
                    <span className="font-medium">{preset.displayName}</span>
                    {preset.name === "cloud-company" && (
                      <Badge variant="secondary" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {preset.description}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Content Level Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Content Level</Label>
          <RadioGroup
            value={config.contentLevel}
            onValueChange={(value) => handleContentLevelChange(value as ContentLevel)}
            className="grid grid-cols-2 gap-3"
          >
            <label className="flex items-start gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="compact" id="level-compact" className="mt-0.5" />
              <div>
                <span className="font-medium">Compact</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Essential info only
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="full" id="level-full" className="mt-0.5" />
              <div>
                <span className="font-medium">Full</span>
                <p className="text-sm text-muted-foreground mt-0.5">
                  All details included
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>

        {/* Include Subtasks Toggle */}
        <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <Label htmlFor="include-subtasks" className="font-medium cursor-pointer">
                Include Subtasks
              </Label>
              <p className="text-sm text-muted-foreground">
                Export subtasks as child issues
              </p>
            </div>
          </div>
          <Switch
            id="include-subtasks"
            checked={config.includeSubtasks}
            onCheckedChange={handleSubtasksChange}
          />
        </div>

        {/* Subtask Warning */}
        {!config.includeSubtasks && subtaskCount > 0 && (
          <Alert className="border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <AlertDescription className="text-warning-foreground">
              {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""} will be excluded from the export.
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Panel */}
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={loadingPreview}
            >
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Preview Sample Output
              </span>
              {previewOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 border-b border-border/50">
                <p className="text-xs text-muted-foreground">
                  Sample of how your data will appear in the CSV
                </p>
              </div>
              <ScrollArea className="h-[200px]">
                {loadingPreview ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Loading preview...
                  </div>
                ) : previewData.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No preview data available
                  </div>
                ) : (
                  <div className="p-3 space-y-3">
                    {previewData.map((row, index) => (
                      <div
                        key={index}
                        className="text-xs font-mono bg-background p-3 rounded border border-border/50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {row["Issue Type"]}
                          </Badge>
                          <span className="text-muted-foreground">
                            {row["Issue ID"]}
                          </span>
                        </div>
                        <p className="font-medium mb-1">{row.Summary}</p>
                        <p className="text-muted-foreground line-clamp-2">
                          {row.Description.slice(0, 150)}
                          {row.Description.length > 150 ? "..." : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
