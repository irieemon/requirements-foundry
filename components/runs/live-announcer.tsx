"use client";

import { useEffect, useRef, useState, createContext, useContext, useCallback } from "react";

interface Announcement {
  message: string;
  politeness: "polite" | "assertive";
  id: number;
}

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: "polite" | "assertive") => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue | null>(null);

/**
 * Provider component that enables live announcements for screen readers.
 * Wrap your app or page with this to enable the useAnnounce hook.
 */
export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const idCounter = useRef(0);

  const announce = useCallback(
    (message: string, politeness: "polite" | "assertive" = "polite") => {
      const id = idCounter.current++;
      setAnnouncements((prev) => [...prev, { message, politeness, id }]);

      // Remove announcement after it's been read
      setTimeout(() => {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }, 1000);
    },
    []
  );

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcements
          .filter((a) => a.politeness === "polite")
          .map((a) => a.message)
          .join(". ")}
      </div>
      {/* Assertive region */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="alert"
      >
        {announcements
          .filter((a) => a.politeness === "assertive")
          .map((a) => a.message)
          .join(". ")}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

/**
 * Hook to announce messages to screen readers.
 * Must be used within a LiveAnnouncerProvider.
 */
export function useAnnounce() {
  const context = useContext(LiveAnnouncerContext);
  if (!context) {
    throw new Error("useAnnounce must be used within a LiveAnnouncerProvider");
  }
  return context.announce;
}

interface LiveAnnouncerProps {
  message: string;
  politeness?: "polite" | "assertive";
}

/**
 * Standalone component for announcing a single message.
 * Use when you can't use the context-based approach.
 */
export function LiveAnnouncer({
  message,
  politeness = "polite",
}: LiveAnnouncerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const previousMessage = useRef<string>("");

  useEffect(() => {
    // Only announce if message changed
    if (message === previousMessage.current) return;
    previousMessage.current = message;

    // Force re-announcement by clearing and setting
    if (ref.current) {
      ref.current.textContent = "";
      // Small delay ensures screen readers detect the change
      const timer = setTimeout(() => {
        if (ref.current) {
          ref.current.textContent = message;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      ref={ref}
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
      role={politeness === "assertive" ? "alert" : "status"}
    />
  );
}

/**
 * Hook for generating progress announcements during a run.
 * Returns the current announcement message based on progress state.
 */
export function useProgressAnnouncements(progress: {
  currentPhase: string | null;
  status: string;
  counts: {
    cardsExtracted: number;
    totalUploads: number;
  };
  phases: Array<{ id: string; label: string; description: string }>;
} | null) {
  const previousPhase = useRef<string | null>(null);
  const previousStatus = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState<{
    message: string;
    politeness: "polite" | "assertive";
  } | null>(null);

  useEffect(() => {
    if (!progress) return;

    // Announce phase transitions
    if (progress.currentPhase !== previousPhase.current && progress.currentPhase) {
      const phase = progress.phases.find((p) => p.id === progress.currentPhase);
      if (phase) {
        setAnnouncement({
          message: `Now ${phase.label.toLowerCase()}: ${phase.description}`,
          politeness: "polite",
        });
      }
      previousPhase.current = progress.currentPhase;
    }

    // Announce status changes
    if (progress.status !== previousStatus.current) {
      if (progress.status === "SUCCEEDED") {
        setAnnouncement({
          message: `Analysis complete. ${progress.counts.cardsExtracted} cards extracted from ${progress.counts.totalUploads} uploads.`,
          politeness: "assertive",
        });
      } else if (progress.status === "FAILED") {
        setAnnouncement({
          message: "Analysis failed. Please check error details and retry.",
          politeness: "assertive",
        });
      }
      previousStatus.current = progress.status;
    }
  }, [progress]);

  return announcement;
}
