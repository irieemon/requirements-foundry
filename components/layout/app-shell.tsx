"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

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
        {/* Mobile: no padding, show mobile nav */}
        {/* Desktop: left padding for sidebar */}
        <div className="md:pl-56">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile navigation - visible on screens < md */}
      <MobileNav />

      {/* Desktop sidebar - visible on screens >= md */}
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      {/* Main content area */}
      {/* Mobile: no left padding (full width) */}
      {/* Desktop: left padding matches sidebar width */}
      <div
        className={cn(
          "transition-all duration-300",
          // No padding on mobile, sidebar padding on desktop
          collapsed ? "md:pl-16" : "md:pl-56"
        )}
      >
        {children}
      </div>
    </div>
  );
}
