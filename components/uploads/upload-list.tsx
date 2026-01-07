"use client";

import { Button } from "@/components/ui/button";
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
import {
  FileText,
  FileSpreadsheet,
  Trash2,
  Layers,
  FileUp,
} from "lucide-react";
import { deleteUpload } from "@/server/actions/uploads";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface UploadListProps {
  uploads: {
    id: string;
    filename: string | null;
    fileType: string;
    extractionStatus: string;
    analysisStatus: string;
    createdAt: Date;
    _count: {
      cards: number;
    };
  }[];
}

export function UploadList({ uploads }: UploadListProps) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this upload and its extracted cards?")) return;

    try {
      await deleteUpload(id);
      toast.success("Upload deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete upload");
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("csv") || fileType.includes("spreadsheet")) {
      return FileSpreadsheet;
    }
    return FileText;
  };

  const getStatusInfo = (
    extractionStatus: string,
    analysisStatus: string
  ): { label: string; variant: "success" | "destructive" | "info" | "warning" | "muted" } => {
    if (extractionStatus === "FAILED") {
      return { label: "Extraction failed", variant: "destructive" };
    }
    if (analysisStatus === "FAILED") {
      return { label: "Analysis failed", variant: "destructive" };
    }
    if (analysisStatus === "COMPLETED") {
      return { label: "Analyzed", variant: "success" };
    }
    if (analysisStatus === "ANALYZING" || analysisStatus === "QUEUED") {
      return { label: "Analyzing", variant: "info" };
    }
    if (extractionStatus === "EXTRACTED") {
      return { label: "Ready", variant: "muted" };
    }
    if (extractionStatus === "EXTRACTING") {
      return { label: "Extracting", variant: "info" };
    }
    return { label: "Pending", variant: "muted" };
  };

  if (uploads.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="No uploads yet"
        description="Paste text or upload files to get started with your requirements analysis."
        compact
      />
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%]">Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cards</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((upload) => {
            const Icon = getFileIcon(upload.fileType);
            const statusInfo = getStatusInfo(
              upload.extractionStatus,
              upload.analysisStatus
            );
            const isProcessing =
              statusInfo.variant === "info" ||
              upload.extractionStatus === "EXTRACTING";

            return (
              <TableRow key={upload.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="font-medium truncate max-w-[200px]">
                      {upload.filename || "Pasted text"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {upload.fileType.split("/")[1] || upload.fileType}
                </TableCell>
                <TableCell>
                  <StatusPill
                    variant={statusInfo.variant}
                    pulse={isProcessing}
                  >
                    {statusInfo.label}
                  </StatusPill>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Layers
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{upload._count.cards}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(upload.createdAt, { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(upload.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    aria-label={`Delete ${upload.filename || "upload"}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
