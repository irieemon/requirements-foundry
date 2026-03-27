"use client";

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

interface BugReportExpandedRowProps {
  report: BugReport;
  pendingEdit?: PendingEdit;
  onSave: (data: { status: string; adminNotes: string | null }) => Promise<void>;
  onEditChange: (data: PendingEdit) => void;
}

function parseBrowserMetadata(raw: string): { userAgent: string; viewport: string } {
  try {
    const parsed = JSON.parse(raw);
    return {
      userAgent: parsed.userAgent || "Unknown",
      viewport: parsed.viewport
        ? `${parsed.viewport.width} x ${parsed.viewport.height}`
        : "Unknown",
    };
  } catch {
    return { userAgent: raw || "Unknown", viewport: "Unknown" };
  }
}

export function BugReportExpandedRow({
  report,
  pendingEdit,
  onSave,
  onEditChange,
}: BugReportExpandedRowProps) {
  const [status, setStatus] = useState(pendingEdit?.status ?? report.status);
  const [adminNotes, setAdminNotes] = useState(
    pendingEdit?.adminNotes ?? report.adminNotes ?? ""
  );
  const [saving, setSaving] = useState(false);
  const statusSelectRef = useRef<HTMLButtonElement>(null);

  // Focus status select on mount for accessibility
  useEffect(() => {
    statusSelectRef.current?.focus();
  }, []);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onEditChange({ status: newStatus, adminNotes });
  };

  const handleNotesChange = (newNotes: string) => {
    setAdminNotes(newNotes);
    onEditChange({ status, adminNotes: newNotes || null });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ status, adminNotes: adminNotes || null });
    } finally {
      setSaving(false);
    }
  };

  const browser = parseBrowserMetadata(report.browserMetadata);

  return (
    <div className="bg-muted/30 p-4 border-t border-border/30">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: Description and Browser Info */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-1">Full Description</h4>
            <p className="text-sm whitespace-pre-wrap">{report.description}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Browser Info</h4>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">User Agent:</span>{" "}
                {browser.userAgent}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Viewport:</span>{" "}
                {browser.viewport}
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Status, Notes, Save */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-1">Status</h4>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger ref={statusSelectRef} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Admin Notes</h4>
            <Textarea
              rows={4}
              placeholder="Add internal notes about this report..."
              value={adminNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
          </div>
          <div className="flex justify-end md:justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
