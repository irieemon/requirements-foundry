"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateServiceLine,
  updateServiceArea,
  updateActivity,
} from "@/server/actions/mss";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type MssLevel = "L2" | "L3" | "L4";

const levelConfig = {
  L2: {
    title: "Edit Service Line",
    description: "Update the Service Line details.",
    entityName: "Service Line",
  },
  L3: {
    title: "Edit Service Area",
    description: "Update the Service Area details.",
    entityName: "Service Area",
  },
  L4: {
    title: "Edit Activity",
    description: "Update the Activity details.",
    entityName: "Activity",
  },
};

interface MssItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

interface MssEditDialogProps {
  level: MssLevel;
  item: MssItem;
  trigger: React.ReactNode;
  onSuccess: () => void;
}

export function MssEditDialog({
  level,
  item,
  trigger,
  onSuccess,
}: MssEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");

  const config = levelConfig[level];

  // Reset form when dialog opens or item changes
  useEffect(() => {
    if (open) {
      setName(item.name);
      setDescription(item.description ?? "");
    }
  }, [open, item.name, item.description]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      let result;

      const updateData = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      switch (level) {
        case "L2":
          result = await updateServiceLine(item.id, updateData);
          break;
        case "L3":
          result = await updateServiceArea(item.id, updateData);
          break;
        case "L4":
          result = await updateActivity(item.id, updateData);
          break;
      }

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`${config.entityName} updated successfully`);
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update entry");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = name !== item.name || description !== (item.description ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={item.code}
                disabled
                className="font-mono bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Codes cannot be changed after creation
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !hasChanges}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
