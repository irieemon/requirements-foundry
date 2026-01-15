"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Hammer, FolderOpen, Activity, Menu, FileText, Layers, BookOpen, ScrollText, ListTodo } from "lucide-react";
import { getProjectName } from "@/server/actions/projects";

// ════════════════════════════════════════════════════════════════
// MOBILE NAVIGATION
// Shows on screens < md (768px) as a header with hamburger menu
// ════════════════════════════════════════════════════════════════

// Regex to match /projects/[id] but not /projects alone
const PROJECT_PATH_REGEX = /^\/projects\/([^\/]+)/;

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/runs", label: "Runs", icon: Activity },
];

// Project section navigation items (shared pattern with sidebar)
const projectSections = [
  { section: "uploads", label: "Uploads", icon: FileText },
  { section: "cards", label: "Cards", icon: Layers },
  { section: "epics", label: "Epics", icon: BookOpen },
  { section: "stories", label: "Stories", icon: ScrollText },
  { section: "subtasks", label: "Subtasks", icon: ListTodo },
  { section: "runs", label: "Runs", icon: Activity },
];

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState<string | null>(null);

  // Detect if we're on a project detail page and extract projectId
  const projectMatch = pathname.match(PROJECT_PATH_REGEX);
  const projectId = projectMatch ? projectMatch[1] : null;

  // Get current section from URL (default to "uploads")
  const currentSection = searchParams.get("section") || "uploads";

  // Fetch project name when projectId changes
  React.useEffect(() => {
    if (projectId) {
      getProjectName(projectId).then(setProjectName);
    } else {
      setProjectName(null);
    }
  }, [projectId]);

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-sidebar px-4">
      {/* Logo */}
      <Link
        href="/projects"
        className="flex items-center space-x-2"
        aria-label="Requirements Foundry home"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground" aria-hidden="true">
          <Hammer className="h-5 w-5" />
        </div>
        <span className="font-semibold text-sidebar-foreground">
          Requirements Foundry
        </span>
      </Link>

      {/* Hamburger Menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="mobile-nav-content"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent
          id="mobile-nav-content"
          side="left"
          className="w-64 bg-sidebar text-sidebar-foreground border-sidebar-border p-0"
          aria-label="Navigation menu"
        >
          <SheetHeader className="border-b border-sidebar-border p-4">
            <SheetTitle className="flex items-center space-x-2 text-sidebar-foreground">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground" aria-hidden="true">
                <Hammer className="h-5 w-5" />
              </div>
              <span>Requirements Foundry</span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 px-3 py-4" role="navigation" aria-label="Mobile navigation">
            {/* Primary Navigation */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Project Sections - shown when viewing a project */}
            {projectId && (
              <>
                {/* Separator */}
                <div className="my-3 border-t border-sidebar-border/50" />

                {/* Project name header */}
                {projectName && (
                  <div className="px-3 py-1.5 mb-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-muted-foreground/70 truncate">
                      {projectName}
                    </p>
                  </div>
                )}

                {/* Project section links */}
                {projectSections.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.section;
                  const href = `/projects/${projectId}?section=${item.section}`;

                  return (
                    <Link
                      key={item.section}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        isActive
                          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
