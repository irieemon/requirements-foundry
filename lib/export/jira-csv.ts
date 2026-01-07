import { stringify } from "csv-stringify/sync";
import type { Epic, Story } from "@prisma/client";

export interface JiraRow {
  "Issue Type": string;
  Summary: string;
  Description: string;
  "Epic Name"?: string;
  "Epic Link"?: string;
  Priority?: string;
  Labels?: string;
  "Story Points"?: string;
  "Acceptance Criteria"?: string;
}

/**
 * Convert epics and stories to JIRA-compatible CSV format
 */
export function exportToJiraCSV(
  epics: (Epic & { stories: Story[] })[],
  options: {
    includeStories?: boolean;
    projectKey?: string;
  } = {}
): string {
  const { includeStories = true, projectKey = "REQ" } = options;
  const rows: JiraRow[] = [];

  for (const epic of epics) {
    // Add epic row
    rows.push({
      "Issue Type": "Epic",
      Summary: epic.title,
      Description: formatDescription(epic.description, epic.businessValue),
      "Epic Name": epic.title,
      Priority: mapPriority(epic.impact),
      Labels: epic.theme ? epic.theme.replace(/\s+/g, "-") : "",
      "Story Points": mapEffortToPoints(epic.effort),
      "Acceptance Criteria": formatAcceptanceCriteria(epic.acceptanceCriteria),
    });

    // Add story rows
    if (includeStories) {
      for (const story of epic.stories) {
        rows.push({
          "Issue Type": "Story",
          Summary: story.title,
          Description: story.userStory + (story.technicalNotes ? `\n\nTechnical Notes:\n${story.technicalNotes}` : ""),
          "Epic Link": epic.code,
          Priority: mapMoSCoWPriority(story.priority),
          Labels: story.persona ? story.persona.replace(/\s+/g, "-") : "",
          "Story Points": mapEffortToPoints(story.effort),
          "Acceptance Criteria": formatAcceptanceCriteria(story.acceptanceCriteria),
        });
      }
    }
  }

  // Generate CSV
  const csv = stringify(rows, {
    header: true,
    columns: [
      "Issue Type",
      "Summary",
      "Description",
      "Epic Name",
      "Epic Link",
      "Priority",
      "Labels",
      "Story Points",
      "Acceptance Criteria",
    ],
  });

  return csv;
}

/**
 * Format description with business value
 */
function formatDescription(description?: string | null, businessValue?: string | null): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (businessValue) parts.push(`\n\nBusiness Value:\n${businessValue}`);
  return parts.join("") || "";
}

/**
 * Format acceptance criteria from JSON string to readable text
 */
function formatAcceptanceCriteria(acJson?: string | null): string {
  if (!acJson) return "";
  try {
    const criteria = JSON.parse(acJson) as string[];
    return criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");
  } catch {
    return acJson;
  }
}

/**
 * Map impact to JIRA priority
 */
function mapPriority(impact?: string | null): string {
  const mapping: Record<string, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return mapping[impact?.toLowerCase() || ""] || "Medium";
}

/**
 * Map MoSCoW to JIRA priority
 */
function mapMoSCoWPriority(priority?: string | null): string {
  const mapping: Record<string, string> = {
    must: "Highest",
    should: "High",
    could: "Medium",
    "won't": "Low",
  };
  return mapping[priority?.toLowerCase() || ""] || "Medium";
}

/**
 * Map T-shirt size effort to story points
 */
function mapEffortToPoints(effort?: string | null): string {
  const mapping: Record<string, string> = {
    xs: "1",
    s: "2",
    m: "5",
    l: "8",
    xl: "13",
  };
  // If already a number, return as-is
  if (effort && /^\d+$/.test(effort)) return effort;
  return mapping[effort?.toLowerCase() || ""] || "3";
}
