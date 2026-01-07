"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

  // Prevent flash of wrong layout on initial load
  if (!mounted) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="pl-56">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "pl-16" : "pl-56"
        )}
      >
        {children}
      </div>
    </div>
  );
}
