// ============================================
// Document Processing - Public API
// ============================================

// Core types
export * from "./types";

// Document processor singleton
export { DocumentProcessor } from "./processor";

// Extractors (for advanced use cases)
export {
  getExtractorForMimeType,
  getAllSupportedMimeTypes,
  EXTRACTORS,
  ExtractionError,
} from "./extractors";

export type { DocumentExtractor } from "./extractors";
