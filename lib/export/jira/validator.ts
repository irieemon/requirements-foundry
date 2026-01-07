// ═══════════════════════════════════════════════════════════════
// EXPORT VALIDATOR
// Preflight validation rules for Jira export
// ═══════════════════════════════════════════════════════════════

import type {
  NormalizedItem,
  ExportConfig,
  ValidationResult,
  ValidationIssue,
  ExtractedData,
} from "./types";
import { countSubtasks, validateHierarchy } from "./normalizer";

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const LIMITS = {
  maxSummaryLength: 255,
  softDescriptionLimit: 32 * 1024, // 32KB
  hardDescriptionLimit: 64 * 1024, // 64KB
  softRowLimit: 500,
  hardRowLimit: 2000,
} as const;

// ─────────────────────────────────────────────────────────────────
// Error Checks (Block Export)
// ─────────────────────────────────────────────────────────────────

function checkNoItems(items: NormalizedItem[]): ValidationIssue | null {
  if (items.length === 0) {
    return {
      code: "E001",
      message: "No items to export. Select at least one epic with stories.",
    };
  }
  return null;
}

function checkSummaryLength(items: NormalizedItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of items) {
    if (item.title.length > LIMITS.maxSummaryLength) {
      issues.push({
        code: "E002",
        message: `Summary exceeds ${LIMITS.maxSummaryLength} characters (will be truncated)`,
        itemId: item.sourceId,
        itemTitle: item.title.slice(0, 50) + "...",
        field: "summary",
      });
    }
  }

  return issues;
}

function checkHierarchy(items: NormalizedItem[]): ValidationIssue | null {
  if (!validateHierarchy(items)) {
    return {
      code: "E003",
      message: "Invalid hierarchy detected. Some items reference missing parents.",
    };
  }
  return null;
}

function checkHardLimits(items: NormalizedItem[]): ValidationIssue | null {
  if (items.length > LIMITS.hardRowLimit) {
    return {
      code: "E004",
      message: `Export exceeds maximum of ${LIMITS.hardRowLimit} rows. Please export in smaller batches.`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Warning Checks (Allow Export)
// ─────────────────────────────────────────────────────────────────

function checkDescriptionLength(items: NormalizedItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of items) {
    const desc = item.description || item.userStory || "";
    if (desc.length > LIMITS.softDescriptionLimit) {
      issues.push({
        code: "W001",
        message: `Description exceeds 32KB and may be truncated on import`,
        itemId: item.sourceId,
        itemTitle: item.title.slice(0, 50),
        field: "description",
      });
    }
  }

  return issues;
}

function checkLabelCharacters(items: NormalizedItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const labelFields = ["theme", "persona"] as const;

  for (const item of items) {
    for (const field of labelFields) {
      const value = item[field];
      if (value && /[^a-zA-Z0-9\s-_]/.test(value)) {
        issues.push({
          code: "W002",
          message: `Special characters in ${field} will be removed from labels`,
          itemId: item.sourceId,
          itemTitle: item.title.slice(0, 50),
          field,
        });
        break; // Only one warning per item
      }
    }
  }

  return issues;
}

function checkSubtasksExcluded(
  data: ExtractedData,
  config: ExportConfig
): ValidationIssue | null {
  if (!config.includeSubtasks) {
    const subtaskCount = countSubtasks(data);
    if (subtaskCount > 0) {
      return {
        code: "W003",
        message: `${subtaskCount} subtask(s) exist but are not included in export. Enable "Include Subtasks" to include them.`,
      };
    }
  }
  return null;
}

function checkLargeExport(items: NormalizedItem[]): ValidationIssue | null {
  if (items.length > LIMITS.softRowLimit) {
    return {
      code: "W004",
      message: `Large export (${items.length} rows) may take longer to import into Jira.`,
    };
  }
  return null;
}

function checkMissingPriority(items: NormalizedItem[]): ValidationIssue | null {
  const missingCount = items.filter(
    (item) => !item.priority && item.issueType !== "Sub-task"
  ).length;

  if (missingCount > 0) {
    return {
      code: "W005",
      message: `${missingCount} item(s) missing priority - will default to "Medium"`,
    };
  }
  return null;
}

function checkMissingEffort(items: NormalizedItem[]): ValidationIssue | null {
  const missingCount = items.filter(
    (item) => !item.effort && item.issueType !== "Sub-task"
  ).length;

  if (missingCount > 0) {
    return {
      code: "W006",
      message: `${missingCount} item(s) missing effort estimate - Story Points will be empty`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────

export function validateExport(
  items: NormalizedItem[],
  data: ExtractedData,
  config: ExportConfig
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Run error checks
  const noItemsError = checkNoItems(items);
  if (noItemsError) errors.push(noItemsError);

  const summaryErrors = checkSummaryLength(items);
  // Note: Summary length is now a warning since we truncate
  warnings.push(...summaryErrors);

  const hierarchyError = checkHierarchy(items);
  if (hierarchyError) errors.push(hierarchyError);

  const limitError = checkHardLimits(items);
  if (limitError) errors.push(limitError);

  // Run warning checks
  const descWarnings = checkDescriptionLength(items);
  warnings.push(...descWarnings);

  const labelWarnings = checkLabelCharacters(items);
  warnings.push(...labelWarnings);

  const subtaskWarning = checkSubtasksExcluded(data, config);
  if (subtaskWarning) warnings.push(subtaskWarning);

  const sizeWarning = checkLargeExport(items);
  if (sizeWarning) warnings.push(sizeWarning);

  const priorityWarning = checkMissingPriority(items);
  if (priorityWarning) warnings.push(priorityWarning);

  const effortWarning = checkMissingEffort(items);
  if (effortWarning) warnings.push(effortWarning);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// Validation Summary
// ─────────────────────────────────────────────────────────────────

export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return "All checks passed. Ready to export.";
  }

  if (!result.isValid) {
    return `Export blocked: ${result.errors.length} error(s) must be resolved.`;
  }

  return `Export ready with ${result.warnings.length} warning(s).`;
}
