"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { exportProjectAsCSV, exportProjectAsJSON, exportEpicAsCSV } from "@/server/actions/export";
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileOutput,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExportProjectButtonProps {
  projectId: string;
  hasEpics?: boolean;
}

export function ExportProjectButton({
  projectId,
  hasEpics = false
}: ExportProjectButtonProps) {
  const [loading, setLoading] = useState(false);

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

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      const csv = await exportProjectAsCSV(projectId);
      downloadFile(csv, `project-${projectId}-jira.csv`, "text/csv");
      toast.success("CSV exported successfully");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    setLoading(true);
    try {
      const json = await exportProjectAsJSON(projectId);
      downloadFile(json, `project-${projectId}-export.json`, "application/json");
      toast.success("JSON exported successfully");
    } catch {
      toast.error("Failed to export JSON");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Featured: Export Wizard */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem
                  asChild={hasEpics}
                  disabled={!hasEpics}
                  className={cn(
                    "cursor-pointer",
                    !hasEpics && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {hasEpics ? (
                    <Link href={`/projects/${projectId}/export`}>
                      <FileOutput className="mr-2 h-4 w-4" aria-hidden="true" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">Export to Jira</span>
                        <span className="text-xs text-muted-foreground">
                          Customizable wizard
                        </span>
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <div className="flex items-center w-full">
                      <FileOutput className="mr-2 h-4 w-4" aria-hidden="true" />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium">Export to Jira</span>
                        <span className="text-xs text-muted-foreground">
                          Customizable wizard
                        </span>
                      </div>
                      <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            {!hasEpics && (
              <TooltipContent side="left">
                <p>Generate epics first to use the export wizard</p>
              </TooltipContent>
            )}
          </Tooltip>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Quick Export
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
            JIRA CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer">
            <FileJson className="mr-2 h-4 w-4" aria-hidden="true" />
            JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

interface ExportEpicButtonProps {
  epicId: string;
  projectId?: string;
}

export function ExportEpicButton({ epicId, projectId }: ExportEpicButtonProps) {
  const [loading, setLoading] = useState(false);

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

  const handleExport = async () => {
    setLoading(true);
    try {
      const csv = await exportEpicAsCSV(epicId);
      downloadFile(csv, `epic-${epicId}-jira.csv`, "text/csv");
      toast.success("Epic exported successfully");
    } catch {
      toast.error("Failed to export epic");
    } finally {
      setLoading(false);
    }
  };

  // If projectId is provided, show dropdown with wizard option
  if (projectId) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/projects/${projectId}/export`}>
              <FileOutput className="mr-2 h-4 w-4" aria-hidden="true" />
              Export Wizard...
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
            Quick CSV Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Simple button if no projectId
  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Export CSV
    </Button>
  );
}
