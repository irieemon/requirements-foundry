// ═══════════════════════════════════════════════════════════════
// FIELD MAPPER
// Maps normalized items to Jira-compatible row format
// ═══════════════════════════════════════════════════════════════

import type { NormalizedItem, JiraExportRow, JiraPreset, ContentLevel } from "./types";
import { getPreset } from "./presets";
import { formatDescription } from "./description-templates";

// ─────────────────────────────────────────────────────────────────
// Priority Mapping
// ─────────────────────────────────────────────────────────────────

const IMPACT_TO_PRIORITY: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const MOSCOW_TO_PRIORITY: Record<string, string> = {
  must: "Highest",
  should: "High",
  could: "Medium",
  "won't": "Low",
  wont: "Low",
};

function mapPriority(priority: string | null | undefined, issueType: string): string {
  if (!priority) return "Medium";

  const normalized = priority.toLowerCase().trim();

  // For epics, map impact values
  if (issueType === "Epic") {
    return IMPACT_TO_PRIORITY[normalized] || "Medium";
  }

  // For stories/subtasks, map MoSCoW values
  return MOSCOW_TO_PRIORITY[normalized] || IMPACT_TO_PRIORITY[normalized] || "Medium";
}

// ─────────────────────────────────────────────────────────────────
// Story Points Mapping
// ─────────────────────────────────────────────────────────────────

const TSHIRT_TO_POINTS: Record<string, string> = {
  xs: "1",
  s: "2",
  sm: "2",
  m: "5",
  md: "5",
  l: "8",
  lg: "8",
  xl: "13",
};

function mapStoryPoints(effort: string | null | undefined): string {
  if (!effort) return "";

  // If already a number, return as-is
  if (/^\d+$/.test(effort)) return effort;

  const normalized = effort.toLowerCase().trim();
  return TSHIRT_TO_POINTS[normalized] || "";
}

// ─────────────────────────────────────────────────────────────────
// Label Formatting
// ─────────────────────────────────────────────────────────────────

function formatLabel(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9-_]/g, "") // Remove special characters
    .toLowerCase();
}

function getLabels(item: NormalizedItem): string {
  switch (item.issueType) {
    case "Epic":
      return formatLabel(item.theme);
    case "Story":
      return formatLabel(item.persona);
    case "Sub-task":
      return ""; // Subtasks don't get labels
    default:
      return "";
  }
}

// ─────────────────────────────────────────────────────────────────
// Summary Formatting
// ─────────────────────────────────────────────────────────────────

const MAX_SUMMARY_LENGTH = 255;

function formatSummary(title: string): string {
  if (!title) return "Untitled";

  // Truncate if too long
  if (title.length > MAX_SUMMARY_LENGTH) {
    return title.slice(0, MAX_SUMMARY_LENGTH - 3) + "...";
  }

  return title;
}

// ─────────────────────────────────────────────────────────────────
// Main Mapping Functions
// ─────────────────────────────────────────────────────────────────

export function mapToJiraRow(
  item: NormalizedItem,
  preset: JiraPreset,
  contentLevel: ContentLevel
): JiraExportRow {
  const presetConfig = getPreset(preset);

  // Determine issue type based on preset (Sub-task vs Subtask)
  const issueType = item.issueType === "Sub-task"
    ? presetConfig.subtaskIssueType
    : item.issueType;

  // Build base row
  const row: JiraExportRow = {
    "Issue ID": item.tempId,
    "Parent ID": item.parentTempId || "",
    "Issue Type": issueType,
    Summary: formatSummary(item.title),
    Description: formatDescription(item, contentLevel, preset),
    Priority: mapPriority(item.priority, item.issueType),
  };

  // Add labels if supported
  if (presetConfig.supportsLabels) {
    row.Labels = getLabels(item);
  }

  // Add story points if supported and not a subtask
  if (presetConfig.storyPointsField && item.issueType !== "Sub-task") {
    const points = mapStoryPoints(item.effort);
    if (presetConfig.storyPointsField === "Story Points") {
      row["Story Points"] = points;
    } else {
      row["Custom field (Story Points)"] = points;
    }
  }

  return row;
}

export function mapToJiraRows(
  items: NormalizedItem[],
  preset: JiraPreset,
  contentLevel: ContentLevel
): JiraExportRow[] {
  return items.map((item) => mapToJiraRow(item, preset, contentLevel));
}

// ─────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────

export { mapPriority, mapStoryPoints, formatLabel, formatSummary };
