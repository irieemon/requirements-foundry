"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  shareProject,
  getProjectShares,
  updateShareRole,
  removeShare,
} from "@/server/actions/shares";
import { UserSearch } from "./user-search";
import type { UserSearchResult } from "./user-search";
import { ShareUserList } from "./share-user-list";
import type { ShareEntry } from "./share-user-list";

interface ShareDialogProps {
  projectId: string;
}

export function ShareDialog({ projectId }: ShareDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    const result = await getProjectShares(projectId);
    if (result.success) {
      setShares(result.shares as ShareEntry[]);
    }
  }, [projectId]);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      await fetchShares();
      setLoading(false);
    } else {
      router.refresh();
    }
  };

  const handleUserSelect = async (user: UserSearchResult) => {
    const result = await shareProject(projectId, user.id);
    if (result.success) {
      toast.success(`Shared with ${user.name || user.email}`);
      await fetchShares();
    } else {
      toast.error(result.error);
    }
  };

  const handleRoleChange = async (shareId: string, newRole: "editor" | "viewer") => {
    const result = await updateShareRole(shareId, newRole);
    if (result.success) {
      toast.success("Role updated");
      await fetchShares();
    } else {
      toast.error(result.error);
    }
  };

  const handleRemove = async (shareId: string) => {
    const result = await removeShare(shareId);
    if (result.success) {
      toast.success("Access removed");
      await fetchShares();
    } else {
      toast.error(result.error);
    }
  };

  const excludeUserIds = shares.map((s) => s.user.id);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <UserSearch
            projectId={projectId}
            onSelect={handleUserSelect}
            excludeUserIds={excludeUserIds}
          />
          <div className="border-t pt-4">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ShareUserList
                shares={shares}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
