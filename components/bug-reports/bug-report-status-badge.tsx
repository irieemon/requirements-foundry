"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-blue-500/15 text-blue-700 border-blue-500/20",
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-500/15 text-green-700 border-green-500/20",
  },
  closed: {
    label: "Closed",
    className: "bg-neutral-500/15 text-neutral-500 border-neutral-500/20",
  },
};

export function BugReportStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
