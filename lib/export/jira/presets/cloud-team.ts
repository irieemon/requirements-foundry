// ═══════════════════════════════════════════════════════════════
// JIRA CLOUD TEAM-MANAGED PRESET
// Preset for Jira Cloud with team-managed (formerly Next-gen) projects
// ═══════════════════════════════════════════════════════════════

import type { PresetConfig } from "../types";

export const cloudTeamPreset: PresetConfig = {
  name: "cloud-team",
  displayName: "Jira Cloud (Team-managed)",
  description: "For simpler team-managed projects. No labels or story points columns. Plain text descriptions.",
  columns: [
    "Issue ID",
    "Parent ID",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
  ],
  subtaskIssueType: "Subtask", // No hyphen for team-managed
  storyPointsField: null,
  supportsLabels: false,
  supportsMarkdown: false, // Plain text only
};
