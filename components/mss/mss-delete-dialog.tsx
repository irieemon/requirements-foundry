"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteServiceLine,
  deleteServiceArea,
  deleteActivity,
} from "@/server/actions/mss";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type MssLevel = "L2" | "L3" | "L4";

interface MssItem {
  id: string;
  code: string;
  name: string;
}

interface CascadeInfo {
  serviceAreaCount?: number;
  activityCount?: number;
}

interface MssDeleteDialogProps {
  level: MssLevel;
  item: MssItem;
  cascadeInfo?: CascadeInfo;
  trigger: React.ReactNode;
  onSuccess: () => void;
}

export function MssDeleteDialog({
  level,
  item,
  cascadeInfo,
  trigger,
  onSuccess,
}: MssDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      let result;

      switch (level) {
        case "L2":
          result = await deleteServiceLine(item.id);
          break;
        case "L3":
          result = await deleteServiceArea(item.id);
          break;
        case "L4":
          result = await deleteActivity(item.id);
          break;
      }

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const entityName = level === "L2" ? "Service Line" : level === "L3" ? "Service Area" : "Activity";
      toast.success(`${entityName} deleted successfully`);
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete entry");
    } finally {
      setLoading(false);
    }
  };

  const getCascadeWarning = () => {
    if (level === "L4") {
      return null;
    }

    if (level === "L2") {
      const areaCount = cascadeInfo?.serviceAreaCount ?? 0;
      const activityCount = cascadeInfo?.activityCount ?? 0;
      if (areaCount > 0 || activityCount > 0) {
        const parts = [];
        if (areaCount > 0) {
          parts.push(`${areaCount} service area${areaCount !== 1 ? "s" : ""}`);
        }
        if (activityCount > 0) {
          parts.push(`${activityCount} activit${activityCount !== 1 ? "ies" : "y"}`);
        }
        return `This will also delete ${parts.join(" and ")}.`;
      }
    }

    if (level === "L3") {
      const activityCount = cascadeInfo?.activityCount ?? 0;
      if (activityCount > 0) {
        return `This will also delete ${activityCount} activit${activityCount !== 1 ? "ies" : "y"}.`;
      }
    }

    return null;
  };

  const cascadeWarning = getCascadeWarning();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Are you sure you want to delete the{" "}
              {level === "L2" ? "Service Line" : level === "L3" ? "Service Area" : "Activity"}{" "}
              <span className="font-mono font-medium">{item.code}</span>?
            </span>
            {cascadeWarning && (
              <span className="block text-destructive font-medium">
                {cascadeWarning}
              </span>
            )}
            <span className="block">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
