"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { generateEpicsForProject } from "@/server/actions/generation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

interface GenerateEpicsButtonProps {
  projectId: string;
  cardCount: number;
  hasExistingEpics: boolean;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function GenerateEpicsButton({
  projectId,
  cardCount,
  hasExistingEpics,
}: GenerateEpicsButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed time counter when loading
  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (hasExistingEpics) {
      const confirmed = confirm(
        "This will regenerate all epics, replacing existing ones. Continue?"
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const result = await generateEpicsForProject(projectId);
      if (result.success) {
        toast.success(
          <div>
            <p className="font-medium">Generated {result.epicCount} epics</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ready to export?{" "}
              <Link
                href={`/projects/${projectId}/export`}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Open Export Wizard
              </Link>
            </p>
          </div>,
          { duration: 6000 }
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to generate epics");
      }
    } catch {
      toast.error("Failed to generate epics");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={loading || cardCount === 0}>
      {loading ? (
        <>
          <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
          <span>Grouping {cardCount} cards...</span>
          <span className="ml-2 font-mono text-xs opacity-80">
            {formatElapsed(elapsedSeconds)}
          </span>
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          {hasExistingEpics ? "Regenerate Epics" : "Generate Epics"}
          {cardCount > 0 && (
            <span className="ml-1 text-xs opacity-70">({cardCount} cards)</span>
          )}
        </>
      )}
    </Button>
  );
}
