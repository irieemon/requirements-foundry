"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { KpiCard } from "./kpi-card";
import { FileText, Layers, BookOpen, Activity, ScrollText, ListTodo, LucideIcon } from "lucide-react";

// Map icon names to actual icon components (client-side only)
const iconMap: Record<string, LucideIcon> = {
  FileText,
  Layers,
  BookOpen,
  Activity,
  ScrollText,
  ListTodo,
};

interface NavigableKpiCardProps {
  label: string;
  value: string | number;
  /** Icon name as string - must match a key in iconMap */
  iconName: "FileText" | "Layers" | "BookOpen" | "Activity" | "ScrollText" | "ListTodo";
  section: string;
  projectId: string;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function NavigableKpiCard({
  label,
  value,
  iconName,
  section,
  projectId,
  trend,
  className,
}: NavigableKpiCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSection = searchParams.get("section") || "uploads";
  const isActive = currentSection === section;

  const handleClick = () => {
    router.push(`/projects/${projectId}?section=${section}`);
  };

  const Icon = iconMap[iconName];

  return (
    <KpiCard
      label={label}
      value={value}
      icon={Icon}
      trend={trend}
      className={className}
      isActive={isActive}
      onClick={handleClick}
    />
  );
}
