// ============================================
// Document Processor - Singleton orchestrator
// ============================================

import { getExtractorForMimeType, ExtractionError } from "./extractors";
import {
  validateFile,
  getMimeTypeFromExtension,
  type ExtractedContent,
  type ProcessingResult,
} from "./types";

/**
 * Document Processor Singleton
 * Orchestrates file validation, routing, and extraction
 */
class DocumentProcessorImpl {
  /**
   * Process a single document
   * @param file - Buffer containing file data
   * @param filename - Original filename
   * @param mimeType - Optional MIME type (detected from extension if not provided)
   */
  async process(
    file: Buffer,
    filename: string,
    mimeType?: string
  ): Promise<ProcessingResult> {
    // Resolve MIME type
    const resolvedMimeType = mimeType || getMimeTypeFromExtension(filename);

    if (!resolvedMimeType) {
      return {
        success: false,
        error: `Unable to determine file type for: ${filename}`,
      };
    }

    // Validate file
    const validation = validateFile(resolvedMimeType, file.length);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Get appropriate extractor
    const extractor = getExtractorForMimeType(resolvedMimeType);
    if (!extractor) {
      return {
        success: false,
        error: `No extractor available for: ${resolvedMimeType}`,
      };
    }

    // Extract content
    try {
      const content = await extractor.extract(file, filename);
      return {
        success: true,
        content,
      };
    } catch (error) {
      if (error instanceof ExtractionError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Process multiple documents in parallel
   * @param files - Array of file objects with buffer, filename, and optional mimeType
   */
  async processMany(
    files: Array<{ file: Buffer; filename: string; mimeType?: string }>
  ): Promise<ProcessingResult[]> {
    return Promise.all(
      files.map(({ file, filename, mimeType }) => this.process(file, filename, mimeType))
    );
  }

  /**
   * Validate a file without processing
   */
  validate(
    filename: string,
    fileSize: number,
    mimeType?: string
  ): { valid: boolean; error?: string } {
    const resolvedMimeType = mimeType || getMimeTypeFromExtension(filename);

    if (!resolvedMimeType) {
      return {
        valid: false,
        error: `Unable to determine file type for: ${filename}`,
      };
    }

    return validateFile(resolvedMimeType, fileSize);
  }

  /**
   * Check if a file type is supported
   */
  isSupported(filename: string, mimeType?: string): boolean {
    const resolvedMimeType = mimeType || getMimeTypeFromExtension(filename);
    if (!resolvedMimeType) return false;
    return getExtractorForMimeType(resolvedMimeType) !== null;
  }
}

// Singleton instance
export const DocumentProcessor = new DocumentProcessorImpl();

// Re-export types for convenience
export type { ExtractedContent, ProcessingResult };
