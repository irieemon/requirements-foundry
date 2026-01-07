// ============================================
// Base Document Extractor Interface
// ============================================

import type { ExtractedContent, ExtractedImage, DocumentMetadata } from "../types";

/**
 * Interface for document content extractors
 * Each extractor handles a specific file type or category
 */
export interface DocumentExtractor {
  /**
   * Unique name for this extractor
   */
  readonly name: string;

  /**
   * MIME types this extractor can handle
   */
  readonly supportedMimeTypes: string[];

  /**
   * Check if this extractor supports the given MIME type
   */
  supports(mimeType: string): boolean;

  /**
   * Extract text and images from a document
   * @param file - Buffer containing the file data
   * @param filename - Original filename for metadata
   * @returns Normalized extracted content
   */
  extract(file: Buffer, filename: string): Promise<ExtractedContent>;
}

/**
 * Abstract base class with common extractor functionality
 */
export abstract class BaseExtractor implements DocumentExtractor {
  abstract readonly name: string;
  abstract readonly supportedMimeTypes: string[];

  /**
   * Check if this extractor supports the given MIME type
   */
  supports(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }

  /**
   * Extract content from document - must be implemented by subclasses
   */
  abstract extract(file: Buffer, filename: string): Promise<ExtractedContent>;

  /**
   * Count words in text
   */
  protected countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Create metadata object with common fields
   */
  protected createMetadata(
    filename: string,
    mimeType: string,
    fileSize: number,
    text: string,
    images: ExtractedImage[],
    extractionMethod: string,
    startTime: number,
    extra: Partial<DocumentMetadata> = {}
  ): DocumentMetadata {
    return {
      filename,
      mimeType,
      fileSize,
      wordCount: this.countWords(text),
      extractionMethod,
      processingTimeMs: Date.now() - startTime,
      hasImages: images.length > 0,
      ...extra,
    };
  }

  /**
   * Clean and normalize extracted text
   */
  protected normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
      .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
      .trim();
  }

  /**
   * Convert buffer to base64 for image storage
   */
  protected bufferToBase64(buffer: Buffer): string {
    return buffer.toString("base64");
  }

  /**
   * Detect image MIME type from buffer magic bytes
   */
  protected detectImageMimeType(buffer: Buffer): string {
    // PNG signature
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    // JPEG signature
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    // GIF signature
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "image/gif";
    }
    // WebP signature
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return "image/webp";
    }
    // Default to PNG
    return "image/png";
  }
}

/**
 * Error thrown when extraction fails
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly extractorName: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}
