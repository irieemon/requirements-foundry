// ============================================
// Document Processing Types & Configuration
// ============================================

/**
 * Supported file type configuration
 * Each entry defines max size and extraction method
 */
export const SUPPORTED_FILE_TYPES = {
  // Text-based
  "text/plain": {
    extractor: "text",
    maxSize: 10_000_000, // 10MB
    extensions: [".txt"],
  },
  "text/markdown": {
    extractor: "text",
    maxSize: 10_000_000,
    extensions: [".md", ".markdown"],
  },
  "text/csv": {
    extractor: "csv",
    maxSize: 50_000_000, // 50MB
    extensions: [".csv"],
  },

  // Documents
  "application/pdf": {
    extractor: "pdf",
    maxSize: 50_000_000,
    extensions: [".pdf"],
    supportedFeatures: ["text", "images", "tables"],
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extractor: "docx",
    maxSize: 50_000_000,
    extensions: [".docx"],
    supportedFeatures: ["text", "images", "tables"],
  },
  "application/msword": {
    extractor: "docx",
    maxSize: 50_000_000,
    extensions: [".doc"],
    supportedFeatures: ["text"],
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extractor: "pptx",
    maxSize: 100_000_000, // 100MB
    extensions: [".pptx"],
    supportedFeatures: ["text", "images", "notes"],
  },
  "application/vnd.ms-powerpoint": {
    extractor: "pptx",
    maxSize: 100_000_000,
    extensions: [".ppt"],
    supportedFeatures: ["text"],
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extractor: "xlsx",
    maxSize: 50_000_000,
    extensions: [".xlsx"],
    supportedFeatures: ["tables", "charts"],
  },
  "application/vnd.ms-excel": {
    extractor: "xlsx",
    maxSize: 50_000_000,
    extensions: [".xls"],
    supportedFeatures: ["tables"],
  },

  // Images
  "image/png": {
    extractor: "image",
    maxSize: 20_000_000, // 20MB
    extensions: [".png"],
  },
  "image/jpeg": {
    extractor: "image",
    maxSize: 20_000_000,
    extensions: [".jpg", ".jpeg"],
  },
  "image/webp": {
    extractor: "image",
    maxSize: 20_000_000,
    extensions: [".webp"],
  },
  "image/gif": {
    extractor: "image",
    maxSize: 10_000_000, // 10MB
    extensions: [".gif"],
  },
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_FILE_TYPES;
export type ExtractorType = (typeof SUPPORTED_FILE_TYPES)[SupportedMimeType]["extractor"];

/**
 * Extracted image from a document
 */
export interface ExtractedImage {
  base64: string;
  mimeType: string;
  pageNumber?: number;
  slideNumber?: number;
  index: number;
  width?: number;
  height?: number;
  description?: string;
}

/**
 * Document metadata after extraction
 */
export interface DocumentMetadata {
  filename: string;
  mimeType: string;
  fileSize: number;
  pageCount?: number;
  slideCount?: number;
  sheetCount?: number;
  wordCount: number;
  extractionMethod: string;
  processingTimeMs: number;
  hasImages: boolean;
}

/**
 * Normalized content extracted from any document type
 */
export interface ExtractedContent {
  text: string;
  images: ExtractedImage[];
  metadata: DocumentMetadata;
}

/**
 * Result of document processing
 */
export interface ProcessingResult {
  success: boolean;
  content?: ExtractedContent;
  error?: string;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): mimeType is SupportedMimeType {
  return mimeType in SUPPORTED_FILE_TYPES;
}

/**
 * Get file type config for a MIME type
 */
export function getFileTypeConfig(mimeType: string) {
  if (!isSupportedMimeType(mimeType)) {
    return null;
  }
  return SUPPORTED_FILE_TYPES[mimeType];
}

/**
 * Validate file against supported types
 */
export function validateFile(
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  const config = getFileTypeConfig(mimeType);

  if (!config) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported types: ${Object.keys(SUPPORTED_FILE_TYPES).join(", ")}`,
    };
  }

  if (fileSize > config.maxSize) {
    const maxMB = Math.round(config.maxSize / 1_000_000);
    const fileMB = Math.round(fileSize / 1_000_000);
    return {
      valid: false,
      error: `File too large: ${fileMB}MB (max: ${maxMB}MB for ${mimeType})`,
    };
  }

  return { valid: true };
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (!ext) return null;

  for (const [mimeType, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    if ((config.extensions as readonly string[]).includes(`.${ext}`)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * Get all supported extensions as a flat array
 */
export function getAllSupportedExtensions(): string[] {
  const extensions: string[] = [];
  for (const config of Object.values(SUPPORTED_FILE_TYPES)) {
    extensions.push(...config.extensions);
  }
  return [...new Set(extensions)];
}

/**
 * Get accept string for file input
 */
export function getAcceptString(): string {
  const accepts: string[] = [];
  for (const [mimeType, config] of Object.entries(SUPPORTED_FILE_TYPES)) {
    accepts.push(mimeType);
    accepts.push(...config.extensions);
  }
  return accepts.join(",");
}
