// ═══════════════════════════════════════════════════════════════
// JIRA CLOUD COMPANY-MANAGED PRESET
// Default preset for Jira Cloud with company-managed projects
// ═══════════════════════════════════════════════════════════════

import type { PresetConfig } from "../types";

export const cloudCompanyPreset: PresetConfig = {
  name: "cloud-company",
  displayName: "Jira Cloud (Company-managed)",
  description: "Best for most Jira Cloud deployments. Supports labels, story points, and markdown in descriptions.",
  columns: [
    "Issue ID",
    "Parent ID",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
    "Labels",
    "Story Points",
  ],
  subtaskIssueType: "Sub-task",
  storyPointsField: "Story Points",
  supportsLabels: true,
  supportsMarkdown: true,
};
