"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Package,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { generateExport, getFullPreviewItems } from "@/server/actions/jira-export";
import type { ExportConfig, ValidationResult, ExportStats, ExportBundle } from "@/lib/export/jira/client";
import type { PreviewItem } from "@/lib/export/jira/types";
import { toast } from "sonner";
import JSZip from "jszip";
import { ExportPreviewTree } from "./export-preview-tree";

interface ValidateDownloadProps {
  projectId: string;
  projectName: string;
  config: ExportConfig;
  validation: ValidationResult;
  stats: ExportStats;
}

export function ValidateDownload({
  projectId,
  projectName,
  config,
  validation,
  stats,
}: ValidateDownloadProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadType, setDownloadType] = useState<"bundle" | "csv" | "instructions" | null>(null);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  // Load preview data on mount
  useEffect(() => {
    loadPreviewData();
  }, [projectId, config]);

  const loadPreviewData = async () => {
    setLoadingPreview(true);
    try {
      const data = await getFullPreviewItems(projectId, config);
      setPreviewItems(data.items);
    } catch (error) {
      console.error("Failed to load preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSafeFilename = (name: string) => {
    return name
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
  };

  const handleDownloadBundle = async () => {
    setDownloading(true);
    setDownloadType("bundle");
    try {
      const bundle: ExportBundle = await generateExport(projectId, config);

      // Create zip file
      const zip = new JSZip();
      const safeName = getSafeFilename(projectName);
      const timestamp = new Date().toISOString().slice(0, 10);

      zip.file("jira-import.csv", bundle.csv);
      zip.file("import-instructions.md", bundle.instructions);
      if (bundle.rawJson) {
        zip.file("raw-data.json", bundle.rawJson);
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}-jira-export-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export bundle downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to generate export bundle");
    } finally {
      setDownloading(false);
      setDownloadType(null);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloading(true);
    setDownloadType("csv");
    try {
      const bundle: ExportBundle = await generateExport(projectId, config);
      const safeName = getSafeFilename(projectName);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(bundle.csv, `${safeName}-jira-import-${timestamp}.csv`, "text/csv;charset=utf-8");
      toast.success("CSV downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to generate CSV");
    } finally {
      setDownloading(false);
      setDownloadType(null);
    }
  };

  const handleDownloadInstructions = async () => {
    setDownloading(true);
    setDownloadType("instructions");
    try {
      const bundle: ExportBundle = await generateExport(projectId, config);
      const safeName = getSafeFilename(projectName);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(
        bundle.instructions,
        `${safeName}-import-instructions-${timestamp}.md`,
        "text/markdown;charset=utf-8"
      );
      toast.success("Instructions downloaded successfully");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to generate instructions");
    } finally {
      setDownloading(false);
      setDownloadType(null);
    }
  };

  // Validation status indicator for tab
  const getValidationIndicator = () => {
    if (hasErrors) return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    if (hasWarnings) return <AlertTriangle className="h-3.5 w-3.5 text-warning-foreground" />;
    return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Validate & Download
        </CardTitle>
        <CardDescription>
          Preview your export, review validation, and download when ready
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Summary - Always visible */}
        <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
          <h4 className="text-sm font-medium mb-4">Export Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.epicCount}</p>
              <p className="text-xs text-muted-foreground">Epics</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.storyCount}</p>
              <p className="text-xs text-muted-foreground">Stories</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.subtaskCount}</p>
              <p className="text-xs text-muted-foreground">Subtasks</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalRows}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Estimated import time: {stats.estimatedImportTime}</span>
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="preview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {stats.totalRows}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="validation" className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Validation</span>
              {getValidationIndicator()}
            </TabsTrigger>
            <TabsTrigger value="download" className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <Card className="border-border/40">
              <CardHeader className="py-4">
                <CardTitle className="text-base">Export Preview</CardTitle>
                <CardDescription>
                  Review the {stats.totalRows} items that will be exported to JIRA
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                <ExportPreviewTree items={previewItems} loading={loadingPreview} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-4">
            {/* Errors */}
            {hasErrors && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Export Blocked</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">
                    {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""} must
                    be resolved before exporting.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validation.errors.map((error, i) => (
                      <li key={i}>
                        <span className="font-mono text-xs">[{error.code}]</span> {error.message}
                        {error.itemTitle && (
                          <span className="text-muted-foreground"> — {error.itemTitle}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {hasWarnings && !hasErrors && (
              <Alert className="border-warning/50 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <AlertTitle className="text-warning-foreground">
                  {validation.warnings.length} Warning{validation.warnings.length !== 1 ? "s" : ""}
                </AlertTitle>
                <AlertDescription className="text-warning-foreground">
                  <p className="mb-2">You can still download, but review these issues:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validation.warnings.map((warning, i) => (
                      <li key={i}>
                        <span className="font-mono text-xs">[{warning.code}]</span> {warning.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* All Good */}
            {!hasErrors && !hasWarnings && (
              <Alert className="border-success/50 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Ready to Export</AlertTitle>
                <AlertDescription className="text-success">
                  All validation checks passed. Your export is ready for download.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Download Tab */}
          <TabsContent value="download" className="space-y-4">
            {/* Download Buttons */}
            <div className="space-y-3">
              {/* Primary: Bundle */}
              <Button
                size="lg"
                className="w-full"
                onClick={handleDownloadBundle}
                disabled={hasErrors || downloading}
              >
                {downloading && downloadType === "bundle" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Download Export Bundle (.zip)
              </Button>

              {/* Secondary: Individual files */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadCSV}
                  disabled={hasErrors || downloading}
                >
                  {downloading && downloadType === "csv" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  CSV Only
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadInstructions}
                  disabled={downloading}
                >
                  {downloading && downloadType === "instructions" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Instructions
                </Button>
              </div>
            </div>

            <Separator />

            {/* Bundle Contents */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Bundle contains:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                  <code>jira-import.csv</code> — Main import file
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <code>import-instructions.md</code> — Step-by-step guide
                </li>
                <li className="flex items-center gap-2">
                  <FileJson className="h-4 w-4" aria-hidden="true" />
                  <code>raw-data.json</code> — Backup data
                </li>
              </ul>
            </div>

            {/* Error blocking message */}
            {hasErrors && (
              <Alert variant="destructive" className="mt-4">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Download Blocked</AlertTitle>
                <AlertDescription>
                  Fix the validation errors before downloading. Check the Validation tab for details.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
