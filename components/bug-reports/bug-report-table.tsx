"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  TableToolbar,
  TableToolbarLeft,
  TableToolbarRight,
  TableContainer,
} from "@/components/ui/table-toolbar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { updateBugReport } from "@/server/actions/bug-reports";
import { BugReportStatusBadge } from "./bug-report-status-badge";
import { BugReportExpandedRow } from "./bug-report-expanded-row";

interface BugReport {
  id: string;
  description: string;
  pageUrl: string;
  submitterEmail: string;
  submitterName: string;
  browserMetadata: string;
  status: string;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PendingEdit {
  status: string;
  adminNotes: string | null;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function BugReportTable({ reports }: { reports: BugReport[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    new Map()
  );

  // Client-side filtering
  const filteredReports =
    statusFilter === "all"
      ? reports
      : reports.filter((r) => r.status === statusFilter);

  // Client-side sorting by createdAt
  const sortedReports = [...filteredReports].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
  });

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const handleRowClick = (reportId: string) => {
    setExpandedId((prev) => (prev === reportId ? null : reportId));
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent,
    reportId: string
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick(reportId);
    }
  };

  const handleEditChange = useCallback(
    (reportId: string, data: PendingEdit) => {
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.set(reportId, data);
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(
    async (
      reportId: string,
      data: { status: string; adminNotes: string | null }
    ) => {
      const result = await updateBugReport(reportId, data);
      if (result.success) {
        toast.success("Bug report updated");
        setPendingEdits((prev) => {
          const next = new Map(prev);
          next.delete(reportId);
          return next;
        });
        router.refresh();
      } else {
        toast.error(
          result.error || "Failed to update bug report. Please try again."
        );
      }
    },
    [router]
  );

  const isFiltered = statusFilter !== "all";
  const reportCountText = isFiltered
    ? `${sortedReports.length} matching`
    : `${sortedReports.length} reports`;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle>All Reports</CardTitle>
        <CardDescription>
          Triage, update status, and add notes to submitted bug reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TableToolbar>
          <TableToolbarLeft>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </TableToolbarLeft>
          <TableToolbarRight>
            <span className="text-sm text-muted-foreground">
              {reportCountText}
            </span>
          </TableToolbarRight>
        </TableToolbar>

        {sortedReports.length === 0 ? (
          <div className="text-center py-12">
            {reports.length === 0 ? (
              <>
                <h3 className="text-sm font-semibold mb-1">
                  No bug reports yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  Bug reports submitted by users will appear here.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold mb-1">
                  No matching reports
                </h3>
                <p className="text-sm text-muted-foreground">
                  No bug reports match the selected status filter. Try selecting
                  a different status.
                </p>
              </>
            )}
          </div>
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={toggleSort}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSort();
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      Date
                      {sortDirection === "desc" ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </span>
                  </TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReports.map((report) => (
                  <>
                    <TableRow
                      key={report.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(report.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, report.id)}
                      tabIndex={0}
                      role="button"
                      aria-expanded={expandedId === report.id}
                    >
                      <TableCell>
                        <BugReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {report.submitterEmail}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeDate(report.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {report.pageUrl}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">
                        {truncate(report.description, 80)}
                      </TableCell>
                    </TableRow>
                    {expandedId === report.id && (
                      <TableRow key={`${report.id}-expanded`}>
                        <TableCell colSpan={5} className="p-0">
                          <BugReportExpandedRow
                            report={report}
                            pendingEdit={pendingEdits.get(report.id)}
                            onSave={(data) => handleSave(report.id, data)}
                            onEditChange={(data) =>
                              handleEditChange(report.id, data)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
