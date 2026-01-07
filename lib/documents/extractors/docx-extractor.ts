// ============================================
// DOCX File Extractor (.docx, .doc)
// ============================================

import mammoth from "mammoth";
import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent, ExtractedImage } from "../types";

export class DOCXExtractor extends BaseExtractor {
  readonly name = "docx";
  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();
    const images: ExtractedImage[] = [];
    let imageIndex = 0;

    try {
      // Extract text using mammoth
      const result = await mammoth.extractRawText({
        buffer: file,
      });

      // Extract embedded images from the document
      // mammoth provides images through a custom image converter
      await mammoth.convertToHtml({
        buffer: file,
        // @ts-expect-error - mammoth types don't include convertImage but it works
        convertImage: mammoth.images.imgElement((image: { contentType?: string; read: (format: string) => Promise<string> }) => {
          return image.read("base64").then((base64Data: string) => {
            const mimeType = image.contentType || "image/png";
            images.push({
              base64: base64Data,
              mimeType,
              index: imageIndex++,
            });
            return { src: `data:${mimeType};base64,${base64Data}` };
          });
        }),
      });

      const text = this.normalizeText(result.value);

      // Log any warnings
      if (result.messages.length > 0) {
        console.warn(`DOCX extraction warnings for ${filename}:`, result.messages);
      }

      return {
        text,
        images,
        metadata: this.createMetadata(
          filename,
          this.supportedMimeTypes[0],
          file.length,
          text,
          images,
          "mammoth",
          startTime
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract DOCX from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }
}
