// ═══════════════════════════════════════════════════════════════
// JIRA EXPORT ENGINE - PUBLIC API
// Requirements Foundry
// ═══════════════════════════════════════════════════════════════

// Types
export type {
  JiraPreset,
  ContentLevel,
  ScopeMode,
  ExportScope,
  ExportConfig,
  NormalizedItem,
  JiraExportRow,
  PresetConfig,
  ValidationResult,
  ValidationIssue,
  ExportStats,
  ExportBundle,
  ExportPreview,
  RunOption,
  EpicOption,
  ExtractedData,
  EpicWithRelations,
  StoryWithSubtasks,
} from "./types";

export { ERROR_CODES, WARNING_CODES } from "./types";

// Presets
export { getPreset, getAllPresets, presets } from "./presets";

// Extractor
export { extractExportData, getEpicOptions, getQuickCounts } from "./extractor";

// Normalizer
export { normalizeForExport, countSubtasks, validateHierarchy } from "./normalizer";

// Mapper
export { mapToJiraRow, mapToJiraRows, mapPriority, mapStoryPoints, formatLabel, formatSummary } from "./mapper";

// Description Templates
export { formatDescription, markdownToWiki } from "./description-templates";

// Validator
export { validateExport, getValidationSummary } from "./validator";

// CSV Generator
export {
  generateJiraCSV,
  generateCSVRows,
  sanitizeForCSV,
  preventFormulaInjection,
  formatCSVCell,
  estimateCSVSize,
} from "./csv-generator";

// Instructions Generator
export { generateInstructions } from "./instructions-generator";

// ─────────────────────────────────────────────────────────────────
// Convenience Function: Full Export Pipeline
// ─────────────────────────────────────────────────────────────────

import type { ExportConfig, ExportBundle, ExportStats } from "./types";
import { extractExportData } from "./extractor";
import { normalizeForExport } from "./normalizer";
import { mapToJiraRows } from "./mapper";
import { validateExport } from "./validator";
import { generateJiraCSV } from "./csv-generator";
import { generateInstructions } from "./instructions-generator";

/**
 * Estimates the import time based on row count.
 */
function estimateImportTime(rowCount: number): string {
  if (rowCount < 50) return "< 1 minute";
  if (rowCount < 200) return "1-2 minutes";
  if (rowCount < 500) return "2-5 minutes";
  if (rowCount < 1000) return "5-10 minutes";
  return "10+ minutes";
}

/**
 * Calculates export statistics from normalized items.
 */
export function calculateStats(
  items: import("./types").NormalizedItem[],
  includeSubtasks: boolean
): ExportStats {
  const epicCount = items.filter((i) => i.issueType === "Epic").length;
  const storyCount = items.filter((i) => i.issueType === "Story").length;
  const subtaskCount = includeSubtasks
    ? items.filter((i) => i.issueType === "Sub-task").length
    : 0;

  return {
    epicCount,
    storyCount,
    subtaskCount,
    totalRows: items.length,
    estimatedImportTime: estimateImportTime(items.length),
  };
}

/**
 * Runs the full export pipeline and returns a complete bundle.
 */
export async function runExportPipeline(
  projectId: string,
  config: ExportConfig
): Promise<ExportBundle> {
  // 1. Extract data from database
  const data = await extractExportData(projectId, config.scope);

  // 2. Normalize to flat structure
  const items = normalizeForExport(data, config.includeSubtasks);

  // 3. Validate
  const validation = validateExport(items, data, config);
  if (!validation.isValid) {
    const errorMessages = validation.errors.map((e) => e.message).join("; ");
    throw new Error(`EGEN001: Validation failed: ${errorMessages}`);
  }

  // 4. Map to Jira rows
  const rows = mapToJiraRows(items, config.preset, config.contentLevel);

  // 5. Generate CSV
  const csv = generateJiraCSV(rows, config.preset);

  // 6. Calculate stats
  const stats = calculateStats(items, config.includeSubtasks);

  // 7. Generate timestamp
  const generatedAt = new Date().toISOString();

  // 8. Generate instructions
  const instructions = generateInstructions(
    data.project.name,
    config,
    stats,
    generatedAt
  );

  // 9. Generate raw JSON
  const rawJson = JSON.stringify(
    {
      project: data.project,
      config,
      items,
      exportedAt: generatedAt,
    },
    null,
    2
  );

  return {
    csv,
    instructions,
    rawJson,
    stats,
    generatedAt,
  };
}
