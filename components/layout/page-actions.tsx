"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════
// PAGE ACTIONS
// Responsive action bar that collapses secondary actions into a
// dropdown menu on smaller screens (< md breakpoint / 768px)
// ════════════════════════════════════════════════════════════════

export interface ActionItem {
  /** Unique identifier for the action */
  id: string;
  /** Label shown in dropdown menu */
  label: string;
  /** Icon to show in dropdown (optional) */
  icon?: React.ReactNode;
  /** Click handler (for simple actions) */
  onClick?: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Full button/link element to render inline (for complex actions) */
  content: React.ReactNode;
}

export interface PageActionsProps {
  /** Primary action - always visible at all viewport sizes */
  primaryAction: React.ReactNode;
  /** Secondary actions - visible on desktop (≥md), in dropdown on mobile/tablet */
  secondaryActions?: ActionItem[];
  /** Additional class names for the container */
  className?: string;
  /** Breakpoint at which to show all actions inline (default: md) */
  breakpoint?: "sm" | "md" | "lg";
}

/**
 * Responsive action bar component.
 *
 * Desktop (≥md): Shows all actions inline
 * Mobile/Tablet (<md): Shows primary action + overflow menu
 *
 * @example
 * ```tsx
 * <PageActions
 *   primaryAction={<Button>Generate Epics</Button>}
 *   secondaryActions={[
 *     {
 *       id: "generate-stories",
 *       label: "Generate Stories",
 *       icon: <Sparkles className="h-4 w-4" />,
 *       content: <GenerateStoriesButton />,
 *     },
 *     {
 *       id: "export",
 *       label: "Export",
 *       icon: <Download className="h-4 w-4" />,
 *       onClick: () => router.push("/export"),
 *       content: <Button variant="outline">Export</Button>,
 *     },
 *   ]}
 * />
 * ```
 */
export function PageActions({
  primaryAction,
  secondaryActions = [],
  className,
  breakpoint = "md",
}: PageActionsProps) {
  const hasSecondaryActions = secondaryActions.length > 0;

  // Breakpoint-specific classes for showing/hiding
  const showInlineClass = {
    sm: "hidden sm:flex",
    md: "hidden md:flex",
    lg: "hidden lg:flex",
  }[breakpoint];

  const showDropdownClass = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
  }[breakpoint];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Primary Action - Always visible */}
      <div className="flex-shrink-0">{primaryAction}</div>

      {/* Secondary Actions - Visible on desktop */}
      {hasSecondaryActions && (
        <div className={cn("items-center gap-2", showInlineClass)}>
          {secondaryActions.map((action) => (
            <div key={action.id} className="flex-shrink-0">
              {action.content}
            </div>
          ))}
        </div>
      )}

      {/* Overflow Menu - Visible on mobile/tablet */}
      {hasSecondaryActions && (
        <div className={showDropdownClass}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
                aria-label="More actions"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {secondaryActions.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="cursor-pointer"
                >
                  {action.icon && (
                    <span className="mr-2 flex-shrink-0" aria-hidden="true">
                      {action.icon}
                    </span>
                  )}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Simpler variant for when you just want responsive inline/overflow
// ─────────────────────────────────────────────────────────────────

export interface SimplePageActionsProps {
  /** All actions to render */
  children: React.ReactNode;
  /** Actions to show in overflow menu on mobile (by index, 0-based) */
  overflowAfter?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Simple responsive action bar using children.
 * Shows all children inline on desktop, collapses overflow to menu on mobile.
 *
 * @example
 * ```tsx
 * <SimplePageActions overflowAfter={1}>
 *   <Button>Primary</Button>
 *   <Button>Secondary</Button>
 *   <Button>Tertiary</Button>
 * </SimplePageActions>
 * ```
 */
export function SimplePageActions({
  children,
  overflowAfter = 1,
  className,
}: SimplePageActionsProps) {
  const childArray = React.Children.toArray(children);
  const visibleChildren = childArray.slice(0, overflowAfter);
  const overflowChildren = childArray.slice(overflowAfter);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Always visible */}
      {visibleChildren}

      {/* Desktop: show remaining inline */}
      {overflowChildren.length > 0 && (
        <div className="hidden md:flex items-center gap-2">
          {overflowChildren}
        </div>
      )}

      {/* Mobile: show remaining in dropdown */}
      {overflowChildren.length > 0 && (
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 min-h-[44px] min-w-[44px]"
                aria-label="More actions"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowChildren.map((child, index) => (
                <DropdownMenuItem key={index} asChild>
                  {child}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
