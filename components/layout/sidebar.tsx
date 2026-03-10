"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Hammer,
  FolderOpen,
  Activity,
  FileText,
  Layers,
  BookOpen,
  ScrollText,
  ListTodo,
} from "lucide-react";
import { getProjectName } from "@/server/actions/projects";
import { UserMenu } from "./user-menu";
import type { UserInfo } from "@/lib/auth/types";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: UserInfo;
  isAdmin: boolean;
}

// Regex to match /projects/[id] but not /projects alone
const PROJECT_PATH_REGEX = /^\/projects\/([^\/]+)/;

// Project section navigation items
const projectSections = [
  { section: "uploads", label: "Uploads", icon: FileText },
  { section: "cards", label: "Cards", icon: Layers },
  { section: "epics", label: "Epics", icon: BookOpen },
  { section: "stories", label: "Stories", icon: ScrollText },
  { section: "subtasks", label: "Subtasks", icon: ListTodo },
  { section: "runs", label: "Runs", icon: Activity },
];

export function Sidebar({ collapsed, onToggle, user, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projectName, setProjectName] = useState<string | null>(null);

  // Detect if we're on a project detail page and extract projectId
  const projectMatch = pathname.match(PROJECT_PATH_REGEX);
  const projectId = projectMatch ? projectMatch[1] : null;

  // Get current section from URL (default to "uploads")
  const currentSection = searchParams.get("section") || "uploads";

  // Fetch project name when projectId changes
  useEffect(() => {
    if (projectId) {
      getProjectName(projectId).then(setProjectName);
    } else {
      setProjectName(null);
    }
  }, [projectId]);

  const navItems = [
    { href: "/projects", label: "Projects", icon: FolderOpen },
    { href: "/runs", label: "Runs", icon: Activity },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          // Hidden on mobile (< md), visible on tablet/desktop
          "hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <Link
            href="/projects"
            className="flex items-center space-x-2 group"
            aria-label="Requirements Foundry home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Hammer className="h-5 w-5" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-sidebar-foreground group-hover:text-sidebar-primary-foreground transition-colors">
                Requirements Foundry
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4" role="navigation">
          {/* Primary Navigation */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                  collapsed ? "justify-center" : "justify-start space-x-3",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}

          {/* Project Sections - shown when viewing a project */}
          {projectId && (
            <>
              {/* Separator */}
              <div className="my-3 border-t border-sidebar-border/50" />

              {/* Project name header - shown when expanded */}
              {!collapsed && projectName && (
                <div className="px-3 py-1.5 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-muted-foreground/70 truncate">
                    {projectName}
                  </p>
                </div>
              )}

              {/* Project sections */}
              <div className="space-y-0.5">
                {projectSections.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentSection === item.section;
                  const href = `/projects/${projectId}?section=${item.section}`;

                  const sectionLink = (
                    <Link
                      key={item.section}
                      href={href}
                      className={cn(
                        "flex items-center rounded-lg py-2 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        collapsed ? "justify-center px-3" : "justify-start space-x-2.5 pl-4 pr-3",
                        isActive
                          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.section}>
                        <TooltipTrigger asChild>{sectionLink}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {projectName ? `${item.label} - ${projectName}` : item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return sectionLink;
                })}
              </div>
            </>
          )}
        </nav>

        {/* User menu with collapse toggle */}
        <UserMenu user={user} isAdmin={isAdmin} collapsed={collapsed} onToggle={onToggle} />
      </aside>
    </TooltipProvider>
  );
}
