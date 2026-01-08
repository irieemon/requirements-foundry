// ═══════════════════════════════════════════════════════════════
// JIRA EXPORT - CLIENT-SAFE EXPORTS
// Only types and utilities that can run in the browser
// For server-side functions (extractExportData, etc.), use server actions
// ═══════════════════════════════════════════════════════════════

// Types (all safe for client)
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

// Presets (no db access)
export { getPreset, getAllPresets, presets } from "./presets";

// Normalizer (pure functions, no db)
export { normalizeForExport, countSubtasks, validateHierarchy } from "./normalizer";

// Mapper (pure functions, no db)
export { mapToJiraRow, mapToJiraRows, mapPriority, mapStoryPoints, formatLabel, formatSummary } from "./mapper";

// Description Templates (pure functions, no db)
export { formatDescription, markdownToWiki } from "./description-templates";

// Validator (pure functions, no db)
export { validateExport, getValidationSummary } from "./validator";

// CSV Generator (pure functions, no db)
export {
  generateJiraCSV,
  generateCSVRows,
  sanitizeForCSV,
  preventFormulaInjection,
  formatCSVCell,
  estimateCSVSize,
} from "./csv-generator";

// Instructions Generator (pure functions, no db)
export { generateInstructions } from "./instructions-generator";
