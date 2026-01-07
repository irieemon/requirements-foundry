// ============================================
// XLSX File Extractor (.xlsx, .xls)
// ============================================

import * as XLSX from "xlsx";
import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent } from "../types";

export class XLSXExtractor extends BaseExtractor {
  readonly name = "xlsx";
  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      // Parse workbook
      const workbook = XLSX.read(file, {
        type: "buffer",
        cellDates: true,
        cellNF: true,
      });

      const sheets: string[] = [];

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays
        const data = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        if (data.length > 0) {
          const sheetText = this.formatSheet(sheetName, data);
          sheets.push(sheetText);
        }
      }

      const text = sheets.join("\n\n");

      return {
        text: this.normalizeText(text),
        images: [], // XLSX doesn't have extractable images in this implementation
        metadata: this.createMetadata(
          filename,
          this.supportedMimeTypes[0],
          file.length,
          text,
          [],
          "xlsx",
          startTime,
          {
            sheetCount: workbook.SheetNames.length,
          }
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract XLSX from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }

  /**
   * Format sheet data as readable text table
   */
  private formatSheet(sheetName: string, data: unknown[][]): string {
    const lines: string[] = [`[Sheet: ${sheetName}]`];

    if (data.length === 0) {
      return lines[0];
    }

    // Calculate column widths (max 30 chars per column)
    const colWidths: number[] = [];
    for (const row of data) {
      for (let i = 0; i < row.length; i++) {
        const cellValue = this.formatCell(row[i]);
        colWidths[i] = Math.max(colWidths[i] || 0, cellValue.length, 3);
      }
    }

    // Cap column widths
    const cappedWidths = colWidths.map((w) => Math.min(w, 30));

    // Format each row
    const separator = cappedWidths.map((w) => "-".repeat(w)).join(" | ");

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const formattedRow = row
        .map((cell, i) => {
          const value = this.formatCell(cell);
          const width = cappedWidths[i] || 3;
          return value.slice(0, width).padEnd(width);
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

  /**
   * Format a cell value to string
   */
  private formatCell(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (value instanceof Date) {
      return value.toISOString().split("T")[0]; // YYYY-MM-DD format
    }
    if (typeof value === "number") {
      // Format numbers nicely
      if (Number.isInteger(value)) {
        return value.toString();
      }
      return value.toFixed(2);
    }
    return String(value).trim();
  }
}
