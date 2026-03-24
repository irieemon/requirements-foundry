"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2 } from "lucide-react";

export interface ShareEntry {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

interface ShareUserListProps {
  shares: ShareEntry[];
  onRoleChange: (shareId: string, newRole: "editor" | "viewer") => Promise<void>;
  onRemove: (shareId: string) => Promise<void>;
}

export function ShareUserList({ shares, onRoleChange, onRemove }: ShareUserListProps) {
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  if (shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No collaborators yet. Use the search above to add users.
      </p>
    );
  }

  const handleRoleChange = async (shareId: string, newRole: "editor" | "viewer") => {
    setUpdatingRole(shareId);
    try {
      await onRoleChange(shareId, newRole);
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRemove = async (shareId: string) => {
    setRemoving(shareId);
    try {
      await onRemove(shareId);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-2">
      {shares.map((share) => {
        const displayName = share.user.name || share.user.email;
        const initial = displayName.charAt(0).toUpperCase();

        return (
          <div
            key={share.id}
            className="flex items-center gap-3 rounded-md border p-2"
          >
            {/* Avatar placeholder */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {initial}
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {share.user.name && (
                <p className="text-xs text-muted-foreground truncate">
                  {share.user.email}
                </p>
              )}
            </div>

            {/* Role dropdown */}
            <Select
              value={share.role}
              onValueChange={(value) =>
                handleRoleChange(share.id, value as "editor" | "viewer")
              }
              disabled={updatingRole === share.id}
            >
              <SelectTrigger size="sm" className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>

            {/* Remove button with confirmation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={removing === share.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Access</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove {displayName} from this project? They will lose all access.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleRemove(share.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })}
    </div>
  );
}
