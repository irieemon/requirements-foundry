// ============================================
// PDF File Extractor (.pdf)
// Uses unpdf - works in serverless/Node.js
// ============================================

import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent, ExtractedImage } from "../types";

export class PDFExtractor extends BaseExtractor {
  readonly name = "pdf";
  readonly supportedMimeTypes = ["application/pdf"];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      // unpdf is designed for serverless/Node.js environments
      const { extractText, getDocumentProxy } = await import("unpdf");

      // Convert Buffer to Uint8Array for unpdf
      const uint8Array = new Uint8Array(file);

      // Extract text from all pages
      const { text, totalPages } = await extractText(uint8Array, { mergePages: true });

      const normalizedText = this.normalizeText(text || "");
      const images: ExtractedImage[] = [];

      return {
        text: normalizedText,
        images,
        metadata: this.createMetadata(
          filename,
          "application/pdf",
          file.length,
          normalizedText,
          images,
          "unpdf",
          startTime,
          {
            pageCount: totalPages,
          }
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract PDF from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }
}
