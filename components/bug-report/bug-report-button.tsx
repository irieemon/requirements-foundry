"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Bug, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { submitBugReport } from "@/server/actions/bug-reports";
import type { UserInfo } from "@/lib/auth/types";

interface BugReportButtonProps {
  user: UserInfo;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BugReportButton({ user }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [touched, setTouched] = useState(false);

  const isValid = description.trim().length >= 10;
  const showError = touched && description.trim().length > 0 && !isValid;

  async function handleSubmit() {
    if (!isValid) return;

    setSubmitting(true);
    try {
      const result = await submitBugReport({
        description: description.trim(),
        pageUrl: window.location.pathname,
        browserMetadata: JSON.stringify({
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        }),
      });

      if (result.success) {
        toast.success("Bug report submitted", {
          description: "Thanks for helping us improve.",
        });
        setDescription("");
        setOpen(false);
        setTouched(false);
        setCooldown(true);
        setTimeout(() => setCooldown(false), 30000);
      } else {
        toast.error("Failed to submit report", {
          description: "Something went wrong. Please try again.",
          duration: 5000,
        });
      }
    } catch {
      toast.error("Failed to submit report", {
        description: "Something went wrong. Please try again.",
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setDescription("");
      setTouched(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!open && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <button
                  className="fixed bottom-20 right-6 md:bottom-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 transition-opacity duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={cooldown}
                  aria-label="Report a bug"
                >
                  <Bug className="h-5 w-5" />
                </button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="left">
              {cooldown ? "Report submitted recently" : "Report Bug"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-description" className="text-sm font-semibold">
              What went wrong?
            </Label>
            <Textarea
              id="bug-description"
              placeholder="Describe the issue you encountered..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              onBlur={() => setTouched(true)}
              rows={4}
              className="resize-none"
              disabled={submitting}
            />
            <div className="flex justify-between items-center">
              {showError ? (
                <p className="text-xs text-destructive" aria-live="polite">
                  Please describe the issue in at least 10 characters.
                </p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">
                {description.length}/2000
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>
              Page:{" "}
              {typeof window !== "undefined" ? window.location.pathname : ""}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Never mind
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting || cooldown}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
