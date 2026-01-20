// ═══════════════════════════════════════════════════════════════
// JIRA EXPORT TYPES
// Requirements Foundry - Jira Export Engine
// ═══════════════════════════════════════════════════════════════

import type { Epic, Story, Subtask } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────

export type JiraPreset = "cloud-company" | "cloud-team" | "server-dc";
export type ContentLevel = "compact" | "full";
export type ScopeMode = "all" | "selected" | "by-run";

export interface ExportScope {
  mode: ScopeMode;
  epicIds?: string[];      // When mode = "selected"
  runId?: string;          // When mode = "by-run"
}

export interface ExportConfig {
  scope: ExportScope;
  preset: JiraPreset;
  contentLevel: ContentLevel;
  includeSubtasks: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────

export type StoryWithSubtasks = Story & { subtasks: Subtask[] };
export type EpicWithRelations = Epic & { stories: StoryWithSubtasks[] };

export interface ExtractedData {
  project: { id: string; name: string };
  epics: EpicWithRelations[];
}

export interface NormalizedItem {
  tempId: string;          // TEMP-E-001, TEMP-S-001, TEMP-ST-001
  parentTempId: string | null;
  issueType: "Epic" | "Story" | "Sub-task";
  sourceId: string;        // Original DB id
  code: string;            // E1, S1, ST1
  epicCode?: string;       // Parent epic code for stories/subtasks
  storyCode?: string;      // Parent story code for subtasks
  title: string;
  // All source fields for mapping
  description?: string | null;
  businessValue?: string | null;
  userStory?: string | null;
  persona?: string | null;
  acceptanceCriteria?: string | null;
  technicalNotes?: string | null;
  priority?: string | null;
  effort?: string | null;
  impact?: string | null;
  theme?: string | null;
  dependencies?: string | null;
}

// ─────────────────────────────────────────────────────────────────
// CSV Row Types
// ─────────────────────────────────────────────────────────────────

export interface JiraExportRow {
  "Issue ID": string;
  "Parent ID": string;
  "Issue Type": string;
  Summary: string;
  Description: string;
  Priority: string;
  Labels?: string;
  "Story Points"?: string;
  "Custom field (Story Points)"?: string;
}

// ─────────────────────────────────────────────────────────────────
// Preset Configuration Types
// ─────────────────────────────────────────────────────────────────

export interface PresetConfig {
  name: string;
  displayName: string;
  description: string;
  columns: string[];
  subtaskIssueType: "Sub-task" | "Subtask";
  storyPointsField: "Story Points" | "Custom field (Story Points)" | null;
  supportsLabels: boolean;
  supportsMarkdown: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  itemId?: string;
  field?: string;
  itemTitle?: string;
}

// Error codes (block export)
export const ERROR_CODES = {
  E001: "No items to export",
  E002: "Summary exceeds 255 characters",
  E003: "Invalid hierarchy detected",
  E004: "Export size exceeds limit",
} as const;

// Warning codes (allow export)
export const WARNING_CODES = {
  W001: "Description exceeds 32KB (will be truncated)",
  W002: "Special characters in labels may need cleanup",
  W003: "Subtasks exist but are not included",
  W004: "Large export (>500 rows) may timeout in Jira",
  W005: "Missing priority values will default to Medium",
  W006: "Missing effort estimates will leave story points empty",
} as const;

// ─────────────────────────────────────────────────────────────────
// Export Bundle Types
// ─────────────────────────────────────────────────────────────────

export interface ExportStats {
  epicCount: number;
  storyCount: number;
  subtaskCount: number;
  totalRows: number;
  estimatedImportTime: string;
}

export interface ExportBundle {
  csv: string;
  instructions: string;
  rawJson?: string;
  stats: ExportStats;
  generatedAt: string;
}

export interface ExportPreview {
  sampleRows: JiraExportRow[];
  validation: ValidationResult;
  stats: ExportStats;
}

// ─────────────────────────────────────────────────────────────────
// Run Option Type (for By Run selector)
// ─────────────────────────────────────────────────────────────────

export interface RunOption {
  id: string;
  type: string;
  createdAt: Date;
  epicCount: number;
  storyCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Epic Option Type (for Select Epics selector)
// ─────────────────────────────────────────────────────────────────

export interface EpicOption {
  id: string;
  code: string;
  title: string;
  storyCount: number;
  subtaskCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Full Preview Types (for JIRA Export Preview Tree)
// ─────────────────────────────────────────────────────────────────

export interface PreviewItem {
  tempId: string;
  parentTempId: string | null;
  issueType: "Epic" | "Story" | "Sub-task";
  code: string;
  title: string;
  priority: string | null;
  effort: string | null;
  // Derived display fields
  storyCount?: number;
  subtaskCount?: number;
}

export interface FullPreviewData {
  items: PreviewItem[];
  stats: ExportStats;
  validation: ValidationResult;
}
