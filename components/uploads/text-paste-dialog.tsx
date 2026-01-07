"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createUploadFromText } from "@/server/actions/uploads";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TextPasteDialogProps {
  projectId: string;
}

export function TextPasteDialog({ projectId }: TextPasteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    try {
      const result = await createUploadFromText(projectId, text.trim(), filename.trim() || undefined);
      if (result.success) {
        toast.success(`Extracted ${result.cardCount} cards from text`);
        setOpen(false);
        setText("");
        setFilename("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to process text");
      }
    } catch {
      toast.error("Failed to upload text");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      setText(clipboardText);
    } catch {
      toast.error("Could not read from clipboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste Text
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Paste Use Case Content</DialogTitle>
            <DialogDescription>
              Paste your use case cards, requirements, or strategy artifacts. The system will
              automatically extract structured cards from the text.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filename">Source Name (optional)</Label>
              <Input
                id="filename"
                placeholder="e.g., Strategy Workshop Notes"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text">Content</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handlePaste}>
                  <ClipboardPaste className="mr-1 h-3 w-3" />
                  Paste from Clipboard
                </Button>
              </div>
              <Textarea
                id="text"
                placeholder={`Paste your use cases here...

Example format:

# Use Case 1: Customer Onboarding
Problem: Manual onboarding takes 3+ days
Target Users: New customers, Sales team
Desired Outcome: < 1 hour onboarding

---

# Use Case 2: Inventory Management
Problem: Stock-outs causing lost sales
...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !text.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extract Cards
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
