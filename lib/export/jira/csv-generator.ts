// ═══════════════════════════════════════════════════════════════
// CSV GENERATOR
// Generates Jira-compatible CSV from export rows
// ═══════════════════════════════════════════════════════════════

import type { JiraExportRow, JiraPreset } from "./types";
import { getPreset } from "./presets";

// ─────────────────────────────────────────────────────────────────
// CSV Escaping & Security
// ─────────────────────────────────────────────────────────────────

/**
 * Sanitizes text for CSV output.
 * - Escapes double quotes (CSV standard)
 * - Removes null bytes
 * - Normalizes line endings
 */
export function sanitizeForCSV(text: string): string {
  if (!text) return "";

  return text
    // Escape double quotes (CSV standard: " becomes "")
    .replace(/"/g, '""')
    // Remove null bytes
    .replace(/\0/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/**
 * Prevents CSV formula injection.
 * Prefixes dangerous characters with a single quote.
 */
export function preventFormulaInjection(text: string): string {
  if (!text) return "";

  const dangerousChars = ["=", "+", "-", "@", "\t", "\r"];
  const trimmed = text.trim();

  if (dangerousChars.some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }

  return trimmed;
}

/**
 * Formats a value for CSV cell.
 * Applies sanitization and wraps in quotes if needed.
 */
export function formatCSVCell(value: string | undefined): string {
  if (value === undefined || value === null) return '""';
  if (value === "") return '""';

  // Apply security measures
  let sanitized = sanitizeForCSV(value);
  sanitized = preventFormulaInjection(sanitized);

  // Wrap in quotes (always quote for safety)
  return `"${sanitized}"`;
}

// ─────────────────────────────────────────────────────────────────
// CSV Row Generation
// ─────────────────────────────────────────────────────────────────

function getHeaderRow(preset: JiraPreset): string {
  const presetConfig = getPreset(preset);
  return presetConfig.columns.join(",");
}

function formatRow(row: JiraExportRow, preset: JiraPreset): string {
  const presetConfig = getPreset(preset);

  const values = presetConfig.columns.map((column) => {
    const value = row[column as keyof JiraExportRow];
    return formatCSVCell(value);
  });

  return values.join(",");
}

// ─────────────────────────────────────────────────────────────────
// Main Generator Function
// ─────────────────────────────────────────────────────────────────

/**
 * Generates a complete CSV string from Jira export rows.
 * Includes BOM for Excel compatibility.
 */
export function generateJiraCSV(
  rows: JiraExportRow[],
  preset: JiraPreset
): string {
  const lines: string[] = [];

  // Add header row
  lines.push(getHeaderRow(preset));

  // Add data rows
  for (const row of rows) {
    lines.push(formatRow(row, preset));
  }

  // Join with CRLF for maximum compatibility
  const csv = lines.join("\r\n");

  // Add UTF-8 BOM for Excel
  const BOM = "\uFEFF";
  return BOM + csv;
}

// ─────────────────────────────────────────────────────────────────
// Generator Function (for streaming large exports)
// ─────────────────────────────────────────────────────────────────

/**
 * Generator function for streaming CSV rows.
 * Yields one line at a time for memory efficiency.
 */
export function* generateCSVRows(
  rows: JiraExportRow[],
  preset: JiraPreset
): Generator<string> {
  // Yield header row first
  yield getHeaderRow(preset);

  // Yield data rows one at a time
  for (const row of rows) {
    yield formatRow(row, preset);
  }
}

// ─────────────────────────────────────────────────────────────────
// CSV Size Estimation
// ─────────────────────────────────────────────────────────────────

/**
 * Estimates the size of the CSV output in bytes.
 */
export function estimateCSVSize(rows: JiraExportRow[], preset: JiraPreset): number {
  // Rough estimate: average row is ~500 bytes
  const avgRowSize = 500;
  const headerSize = 100;
  return headerSize + rows.length * avgRowSize;
}
