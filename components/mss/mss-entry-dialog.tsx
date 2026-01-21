"use client";

import { useState } from "react";
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
  createServiceLine,
  createServiceArea,
  createActivity,
} from "@/server/actions/mss";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type MssLevel = "L2" | "L3" | "L4";

const levelConfig = {
  L2: {
    title: "Add Service Line",
    description: "Create a new L2 Service Line in the MSS taxonomy.",
    codePlaceholder: "e.g., INF",
    namePlaceholder: "e.g., Infrastructure",
  },
  L3: {
    title: "Add Service Area",
    description: "Create a new L3 Service Area under the selected Service Line.",
    codePlaceholder: "e.g., INF-NET",
    namePlaceholder: "e.g., Network Services",
  },
  L4: {
    title: "Add Activity",
    description: "Create a new L4 Activity under the selected Service Area.",
    codePlaceholder: "e.g., INF-NET-001",
    namePlaceholder: "e.g., Network Monitoring",
  },
};

interface MssEntryDialogProps {
  level: MssLevel;
  parentId?: string;
  parentName?: string;
  trigger: React.ReactNode;
  onSuccess: () => void;
}

export function MssEntryDialog({
  level,
  parentId,
  parentName,
  trigger,
  onSuccess,
}: MssEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const config = levelConfig[level];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    setLoading(true);
    try {
      let result;

      switch (level) {
        case "L2":
          result = await createServiceLine({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || undefined,
          });
          break;
        case "L3":
          if (!parentId) throw new Error("Parent Service Line ID required");
          result = await createServiceArea({
            serviceLineId: parentId,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || undefined,
          });
          break;
        case "L4":
          if (!parentId) throw new Error("Parent Service Area ID required");
          result = await createActivity({
            serviceAreaId: parentId,
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || undefined,
          });
          break;
      }

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const entityName = level === "L2" ? "Service Line" : level === "L3" ? "Service Area" : "Activity";
      toast.success(`${entityName} created successfully`);
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create entry");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const title = parentName ? `${config.title} to "${parentName}"` : config.title;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{config.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                placeholder={config.codePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={loading}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (uppercase alphanumeric)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder={config.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this entry..."
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
            <Button type="submit" disabled={loading || !code.trim() || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
