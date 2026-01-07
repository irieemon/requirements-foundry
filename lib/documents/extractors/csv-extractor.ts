// ============================================
// CSV File Extractor (.csv)
// ============================================

import Papa from "papaparse";
import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent } from "../types";

export class CSVExtractor extends BaseExtractor {
  readonly name = "csv";
  readonly supportedMimeTypes = ["text/csv"];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      const csvText = file.toString("utf-8");

      // Parse CSV
      const result = Papa.parse<string[]>(csvText, {
        header: false,
        skipEmptyLines: true,
      });

      if (result.errors.length > 0) {
        console.warn(`CSV parsing warnings for ${filename}:`, result.errors);
      }

      // Convert to formatted text table
      const text = this.formatAsTable(result.data);

      return {
        text,
        images: [],
        metadata: this.createMetadata(
          filename,
          "text/csv",
          file.length,
          text,
          [],
          "papaparse",
          startTime,
          {
            // CSV-specific: row count as "pages"
            pageCount: result.data.length,
          }
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract CSV from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }

  /**
   * Format CSV data as readable text table
   */
  private formatAsTable(data: string[][]): string {
    if (data.length === 0) {
      return "";
    }

    // Calculate column widths
    const colWidths: number[] = [];
    for (const row of data) {
      for (let i = 0; i < row.length; i++) {
        const cellWidth = (row[i] || "").length;
        colWidths[i] = Math.max(colWidths[i] || 0, cellWidth, 3);
      }
    }

    // Format rows
    const lines: string[] = [];
    const separator = colWidths.map((w) => "-".repeat(Math.min(w, 50))).join(" | ");

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const formattedRow = row
        .map((cell, i) => {
          const maxWidth = Math.min(colWidths[i], 50);
          const truncated = (cell || "").slice(0, maxWidth);
          return truncated.padEnd(maxWidth);
        })
        .join(" | ");

      lines.push(formattedRow);

      // Add separator after header row
      if (rowIndex === 0) {
        lines.push(separator);
      }
    }

    return lines.join("\n");
  }
}
