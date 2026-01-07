// ============================================
// Image File Extractor (PNG, JPEG, WebP, GIF)
// ============================================

import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent, ExtractedImage } from "../types";

export class ImageExtractor extends BaseExtractor {
  readonly name = "image";
  readonly supportedMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      // Detect actual MIME type from buffer
      const detectedMimeType = this.detectImageMimeType(file);

      // Get basic image info from buffer
      const dimensions = this.getImageDimensions(file, detectedMimeType);

      // Create image entry for the document
      const image: ExtractedImage = {
        base64: this.bufferToBase64(file),
        mimeType: detectedMimeType,
        index: 0,
        width: dimensions?.width,
        height: dimensions?.height,
        description: `Image file: ${filename}`,
      };

      // For images, text is empty - the image itself is the content
      // Claude will analyze the image content when processing
      const text = `[Image: ${filename}]${dimensions ? ` (${dimensions.width}x${dimensions.height})` : ""}`;

      return {
        text,
        images: [image],
        metadata: this.createMetadata(
          filename,
          detectedMimeType,
          file.length,
          text,
          [image],
          "image-direct",
          startTime
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract image from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }

  /**
   * Get image dimensions from buffer
   * Basic implementation that reads common image format headers
   */
  private getImageDimensions(
    buffer: Buffer,
    mimeType: string
  ): { width: number; height: number } | null {
    try {
      if (mimeType === "image/png") {
        return this.getPngDimensions(buffer);
      }
      if (mimeType === "image/jpeg") {
        return this.getJpegDimensions(buffer);
      }
      if (mimeType === "image/gif") {
        return this.getGifDimensions(buffer);
      }
      if (mimeType === "image/webp") {
        return this.getWebpDimensions(buffer);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get PNG dimensions from IHDR chunk
   */
  private getPngDimensions(buffer: Buffer): { width: number; height: number } | null {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    // IHDR chunk starts at byte 8, width at 16, height at 20
    if (buffer.length < 24) return null;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  /**
   * Get JPEG dimensions from SOF0 marker
   */
  private getJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
    // Search for SOF0 marker (FF C0) or SOF2 (FF C2)
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        // SOF0, SOF1, SOF2 markers contain dimensions
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        // Skip to next marker
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        offset++;
      }
    }
    return null;
  }

  /**
   * Get GIF dimensions from header
   */
  private getGifDimensions(buffer: Buffer): { width: number; height: number } | null {
    // GIF header: GIF87a or GIF89a, dimensions at bytes 6-9
    if (buffer.length < 10) return null;
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    return { width, height };
  }

  /**
   * Get WebP dimensions
   */
  private getWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
    // WebP: RIFF....WEBP, VP8 chunk contains dimensions
    if (buffer.length < 30) return null;

    // Check for VP8 (lossy) at offset 12
    if (buffer.toString("ascii", 12, 16) === "VP8 ") {
      // VP8 bitstream starts at offset 20
      // Frame width and height encoded in first bytes after signature
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }

    // Check for VP8L (lossless) at offset 12
    if (buffer.toString("ascii", 12, 16) === "VP8L") {
      // VP8L header at offset 21
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    return null;
  }
}
