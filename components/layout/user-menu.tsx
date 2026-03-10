"use client";

import { cn } from "@/lib/utils";
import type { UserInfo } from "@/lib/auth/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut, PanelLeft, PanelLeftClose } from "lucide-react";

interface UserMenuProps {
  user: UserInfo;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export function UserMenu({ user, isAdmin, collapsed, onToggle }: UserMenuProps) {
  const initials = getInitials(user.name, user.email);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left",
          collapsed && "justify-center px-0"
        )}
        aria-label="User menu"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
          {initials}
        </div>
        {!collapsed && (
          <span className="truncate font-medium">{user.name || user.email}</span>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <div className="border-t border-sidebar-border p-3">
      <DropdownMenu>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {user.name || user.email}
            </TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                {isAdmin && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggle}>
            {collapsed ? (
              <PanelLeft className="mr-2 h-4 w-4" />
            ) : (
              <PanelLeftClose className="mr-2 h-4 w-4" />
            )}
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
