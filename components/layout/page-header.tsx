"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumb, BreadcrumbItem } from "@/components/layout/breadcrumb";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  breadcrumbs,
  actions,
  sticky = true,
  className,
}: PageHeaderProps) {
  // When breadcrumbs provided, use them instead of back button
  const showBackButton = !breadcrumbs && backHref;

  return (
    <header
      className={cn(
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50",
        sticky && "sticky top-0 z-30",
        className
      )}
    >
      <div className="px-6 py-4">
        {/* Breadcrumb row - above title when present */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb items={breadcrumbs} className="mb-2" />
        )}

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {showBackButton && (
              <Link href={backHref} aria-label={backLabel}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      </div>
    </header>
  );
}
