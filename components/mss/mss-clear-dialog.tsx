"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { clearMssData } from "@/server/actions/mss";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MssStats } from "@/lib/mss/types";

interface MssClearDialogProps {
  stats?: MssStats | null;
}

export function MssClearDialog({ stats }: MssClearDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const hasData = stats && (stats.serviceLines > 0 || stats.serviceAreas > 0 || stats.activities > 0);

  const handleClear = async () => {
    setLoading(true);
    try {
      const result = await clearMssData();
      if (result.success) {
        toast.success("Service taxonomy cleared successfully");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to clear service taxonomy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" disabled={!hasData}>
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Clear all data</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Service Taxonomy</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all{" "}
            {stats && (
              <>
                <strong>{stats.serviceLines}</strong> service lines,{" "}
                <strong>{stats.serviceAreas}</strong> service areas, and{" "}
                <strong>{stats.activities}</strong> activities
              </>
            )}
            . This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleClear();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear All Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
