// ============================================
// Extractor Registry - Central export point
// ============================================

export { BaseExtractor, ExtractionError } from "./base";
export type { DocumentExtractor } from "./base";

export { TextExtractor } from "./text-extractor";
export { CSVExtractor } from "./csv-extractor";
export { PDFExtractor } from "./pdf-extractor";
export { DOCXExtractor } from "./docx-extractor";
export { PPTXExtractor } from "./pptx-extractor";
export { XLSXExtractor } from "./xlsx-extractor";
export { ImageExtractor } from "./image-extractor";

import type { DocumentExtractor } from "./base";
import { TextExtractor } from "./text-extractor";
import { CSVExtractor } from "./csv-extractor";
import { PDFExtractor } from "./pdf-extractor";
import { DOCXExtractor } from "./docx-extractor";
import { PPTXExtractor } from "./pptx-extractor";
import { XLSXExtractor } from "./xlsx-extractor";
import { ImageExtractor } from "./image-extractor";

/**
 * All available extractors
 * Order matters for MIME type matching - first match wins
 */
export const EXTRACTORS: DocumentExtractor[] = [
  new TextExtractor(),
  new CSVExtractor(),
  new PDFExtractor(),
  new DOCXExtractor(),
  new PPTXExtractor(),
  new XLSXExtractor(),
  new ImageExtractor(),
];

/**
 * Find extractor for a given MIME type
 */
export function getExtractorForMimeType(mimeType: string): DocumentExtractor | null {
  return EXTRACTORS.find((e) => e.supports(mimeType)) || null;
}

/**
 * Get all supported MIME types
 */
export function getAllSupportedMimeTypes(): string[] {
  const types = new Set<string>();
  for (const extractor of EXTRACTORS) {
    for (const mimeType of extractor.supportedMimeTypes) {
      types.add(mimeType);
    }
  }
  return Array.from(types);
}
