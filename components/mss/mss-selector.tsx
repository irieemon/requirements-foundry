"use client";

import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getMssHierarchy } from "@/server/actions/mss";
import { Check, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MssServiceArea {
  id: string;
  code: string;
  name: string;
}

interface MssServiceLine {
  id: string;
  code: string;
  name: string;
  serviceAreas: MssServiceArea[];
}

export interface MssSelectorProps {
  /** Current selected MSS Service Area ID */
  value: string | null;
  /** Callback when selection changes */
  onSelect: (id: string | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional: Pre-loaded hierarchy to avoid re-fetching */
  hierarchy?: MssServiceLine[];
}

/**
 * MSS Service Area selector component.
 * Displays L3 options grouped by their L2 parent.
 * Uses a Badge as trigger with dropdown for selection.
 */
export function MssSelector({
  value,
  onSelect,
  disabled = false,
  hierarchy: preloadedHierarchy,
}: MssSelectorProps) {
  const [hierarchy, setHierarchy] = useState<MssServiceLine[]>(preloadedHierarchy || []);
  const [isLoading, setIsLoading] = useState(!preloadedHierarchy);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch hierarchy on mount if not preloaded
  useEffect(() => {
    if (preloadedHierarchy) return;

    async function fetchHierarchy() {
      setIsLoading(true);
      try {
        const result = await getMssHierarchy();
        if (result.success && result.data) {
          setHierarchy(result.data as MssServiceLine[]);
        }
      } catch (error) {
        console.error("Failed to fetch MSS hierarchy:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHierarchy();
  }, [preloadedHierarchy]);

  // Find selected service area from hierarchy
  const selectedArea = useMemo(() => {
    for (const line of hierarchy) {
      const area = line.serviceAreas.find((a) => a.id === value);
      if (area) return area;
    }
    return null;
  }, [hierarchy, value]);

  // Filter hierarchy based on search query
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery.trim()) return hierarchy;

    const query = searchQuery.toLowerCase();
    return hierarchy
      .map((line) => ({
        ...line,
        serviceAreas: line.serviceAreas.filter(
          (area) =>
            area.code.toLowerCase().includes(query) ||
            area.name.toLowerCase().includes(query) ||
            line.code.toLowerCase().includes(query) ||
            line.name.toLowerCase().includes(query)
        ),
      }))
      .filter((line) => line.serviceAreas.length > 0);
  }, [hierarchy, searchQuery]);

  // Reset search when dropdown closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery("");
    }
  };

  // Handle selection
  const handleSelect = (id: string | null) => {
    onSelect(id);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-5 w-24 rounded-full" />;
  }

  // Empty state - no MSS data
  if (hierarchy.length === 0) {
    return (
      <Badge
        variant="outline"
        className="text-xs text-muted-foreground cursor-not-allowed opacity-60"
      >
        <Layers className="mr-1 h-3 w-3" />
        No MSS data
      </Badge>
    );
  }

  // Read-only display when disabled
  if (disabled) {
    return (
      <Badge variant="outline" className="text-xs">
        <Layers className="mr-1 h-3 w-3" />
        {selectedArea ? `${selectedArea.code}` : "No service line"}
      </Badge>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-xs cursor-pointer hover:bg-accent transition-colors",
            selectedArea && "bg-primary/5 border-primary/20"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Layers className="mr-1 h-3 w-3" />
          {selectedArea ? selectedArea.code : "No service line"}
        </Badge>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[300px] max-h-[400px] overflow-hidden"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-2">
          <Input
            placeholder="Search service lines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        <DropdownMenuSeparator />

        {/* Scrollable content */}
        <div className="max-h-[300px] overflow-y-auto">
          {/* Clear selection option */}
          {value && (
            <>
              <DropdownMenuItem
                onClick={() => handleSelect(null)}
                className="text-muted-foreground"
              >
                <X className="mr-2 h-4 w-4" />
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* No results */}
          {filteredHierarchy.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          )}

          {/* Grouped options */}
          {filteredHierarchy.map((line) => (
            <DropdownMenuGroup key={line.id}>
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground sticky top-0 bg-popover">
                {line.name}
              </DropdownMenuLabel>
              {line.serviceAreas.map((area) => (
                <DropdownMenuItem
                  key={area.id}
                  onClick={() => handleSelect(area.id)}
                  className="pl-4"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === area.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{area.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
