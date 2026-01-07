// ═══════════════════════════════════════════════════════════════
// JIRA SERVER/DATA CENTER PRESET
// Preset for on-premise Jira Server and Data Center deployments
// ═══════════════════════════════════════════════════════════════

import type { PresetConfig } from "../types";

export const serverDcPreset: PresetConfig = {
  name: "server-dc",
  displayName: "Jira Server / Data Center",
  description: "For on-premise deployments. Uses custom field for story points and wiki markup in descriptions.",
  columns: [
    "Issue ID",
    "Parent ID",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
    "Labels",
    "Custom field (Story Points)",
  ],
  subtaskIssueType: "Sub-task",
  storyPointsField: "Custom field (Story Points)",
  supportsLabels: true,
  supportsMarkdown: false, // Uses wiki markup instead
};
