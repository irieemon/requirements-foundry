"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/layout/empty-state";
import { TableContainer } from "@/components/ui/table-toolbar";
import { formatDistanceToNow } from "date-fns";
import { Layers, BookOpen, FileDown, Sparkles, Activity, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Run {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokensUsed: number | null;
  errorMsg: string | null;
}

interface RunListProps {
  runs: Run[];
  showProject?: boolean;
  projectName?: string;
}

export function RunList({ runs, showProject, projectName }: RunListProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EXTRACT_CARDS":
        return Layers;
      case "GENERATE_EPICS":
        return Sparkles;
      case "GENERATE_STORIES":
        return BookOpen;
      case "EXPORT":
        return FileDown;
      default:
        return Activity;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "EXTRACT_CARDS":
        return "Extract Cards";
      case "GENERATE_EPICS":
        return "Generate Epics";
      case "GENERATE_STORIES":
        return "Generate Stories";
      case "EXPORT":
        return "Export";
      default:
        return type;
    }
  };

  const getStatusInfo = (
    status: string
  ): { label: string; variant: "success" | "destructive" | "info" | "warning" | "muted" } => {
    switch (status) {
      case "SUCCEEDED":
        return { label: "Complete", variant: "success" };
      case "FAILED":
        return { label: "Failed", variant: "destructive" };
      case "RUNNING":
        return { label: "Running", variant: "info" };
      case "CANCELLED":
        return { label: "Cancelled", variant: "warning" };
      case "QUEUED":
        return { label: "Queued", variant: "muted" };
      default:
        return { label: status, variant: "muted" };
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No runs yet"
        description="Generate epics or stories to create AI processing runs."
        compact
      />
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%]">Type</TableHead>
            <TableHead>Status</TableHead>
            {showProject && <TableHead>Project</TableHead>}
            <TableHead>Duration</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const Icon = getTypeIcon(run.type);
            const statusInfo = getStatusInfo(run.status);
            const isRunning = run.status === "RUNNING";

            return (
              <TableRow key={run.id} className="group">
                <TableCell>
                  <Link
                    href={`/runs/${run.id}`}
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        statusInfo.variant === "success" && "bg-success/10",
                        statusInfo.variant === "destructive" && "bg-destructive/10",
                        statusInfo.variant === "info" && "bg-primary/10",
                        statusInfo.variant === "warning" && "bg-warning/10",
                        statusInfo.variant === "muted" && "bg-muted"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          statusInfo.variant === "success" && "text-success",
                          statusInfo.variant === "destructive" && "text-destructive",
                          statusInfo.variant === "info" && "text-primary",
                          statusInfo.variant === "warning" && "text-warning-foreground",
                          statusInfo.variant === "muted" && "text-muted-foreground"
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="font-medium">{getTypeLabel(run.type)}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusPill variant={statusInfo.variant} pulse={isRunning}>
                    {statusInfo.label}
                  </StatusPill>
                </TableCell>
                {showProject && (
                  <TableCell className="text-muted-foreground">
                    {projectName || "-"}
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{formatDuration(run.durationMs)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {run.tokensUsed ? run.tokensUsed.toLocaleString() : "-"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(run.createdAt, { addSuffix: true })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
