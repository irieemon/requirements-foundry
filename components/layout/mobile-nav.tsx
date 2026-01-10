"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Hammer, FolderOpen, Activity, Menu } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// MOBILE NAVIGATION
// Shows on screens < md (768px) as a header with hamburger menu
// ════════════════════════════════════════════════════════════════

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/runs", label: "Runs", icon: Activity },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-sidebar px-4">
      {/* Logo */}
      <Link
        href="/projects"
        className="flex items-center space-x-2"
        aria-label="Requirements Foundry home"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
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
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 bg-sidebar text-sidebar-foreground border-sidebar-border p-0"
        >
          <SheetHeader className="border-b border-sidebar-border p-4">
            <SheetTitle className="flex items-center space-x-2 text-sidebar-foreground">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Hammer className="h-5 w-5" />
              </div>
              <span>Requirements Foundry</span>
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 px-3 py-4" role="navigation">
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
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
