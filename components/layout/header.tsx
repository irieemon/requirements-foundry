"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Hammer, FolderOpen, Activity } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  // Fetch AI status after hydration to avoid server/client mismatch
  useEffect(() => {
    async function checkAiStatus() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setAiStatus(data.aiEnabled ? "AI: Connected" : "AI: Mock Mode");
      } catch {
        setAiStatus("AI: Mock Mode");
      }
    }
    checkAiStatus();
  }, []);

  const navItems = [
    { href: "/projects", label: "Projects", icon: FolderOpen },
    { href: "/runs", label: "Runs", icon: Activity },
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/projects" className="flex items-center space-x-2 mr-6">
          <Hammer className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Requirements Foundry</span>
        </Link>

        <nav className="flex items-center space-x-4 lg:space-x-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-1 text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center space-x-4">
          {aiStatus && (
            <span className="text-xs text-muted-foreground">
              {aiStatus}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
