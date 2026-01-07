// ============================================
// Text File Extractor (.txt, .md)
// ============================================

import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent } from "../types";

export class TextExtractor extends BaseExtractor {
  readonly name = "text";
  readonly supportedMimeTypes = ["text/plain", "text/markdown"];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      // Decode buffer to string (UTF-8)
      const text = this.normalizeText(file.toString("utf-8"));

      return {
        text,
        images: [],
        metadata: this.createMetadata(
          filename,
          this.getMimeType(filename),
          file.length,
          text,
          [],
          "text-direct",
          startTime
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract text from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "md" || ext === "markdown") {
      return "text/markdown";
    }
    return "text/plain";
  }
}
