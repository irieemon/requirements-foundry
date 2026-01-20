"use client";

import { useEffect, useState } from "react";
import { getMssStats } from "@/server/actions/mss";
import { Card } from "@/components/ui/card";
import { Layers, LayoutGrid, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MssStats } from "@/lib/mss/types";

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ElementType;
}

function StatItem({ label, value, icon: Icon }: StatItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface MssStatsCardProps {
  className?: string;
  /** Optional initial stats from server */
  initialStats?: MssStats;
}

export function MssStatsCard({ className, initialStats }: MssStatsCardProps) {
  const [stats, setStats] = useState<MssStats | null>(initialStats || null);
  const [loading, setLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await getMssStats();
        if (result.success) {
          setStats(result.data);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    // Always fetch fresh stats to ensure sync with hierarchy viewer
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      </Card>
    );
  }

  if (!stats || (stats.serviceLines === 0 && stats.serviceAreas === 0 && stats.activities === 0)) {
    return null; // Don't show empty stats card
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-wrap gap-6 sm:gap-12">
        <StatItem
          label="Service Lines (L2)"
          value={stats.serviceLines}
          icon={Layers}
        />
        <StatItem
          label="Service Areas (L3)"
          value={stats.serviceAreas}
          icon={LayoutGrid}
        />
        <StatItem
          label="Activities (L4)"
          value={stats.activities}
          icon={Activity}
        />
      </div>
    </Card>
  );
}
