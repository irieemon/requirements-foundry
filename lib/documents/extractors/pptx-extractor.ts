// ============================================
// PPTX File Extractor (.pptx, .ppt)
// ============================================

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { BaseExtractor, ExtractionError } from "./base";
import type { ExtractedContent, ExtractedImage } from "../types";

export class PPTXExtractor extends BaseExtractor {
  readonly name = "pptx";
  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ];

  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  async extract(file: Buffer, filename: string): Promise<ExtractedContent> {
    const startTime = Date.now();

    try {
      const zip = await JSZip.loadAsync(file);
      const slides: string[] = [];
      const images: ExtractedImage[] = [];
      let imageIndex = 0;

      // Find all slide XML files
      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
          return numA - numB;
        });

      // Extract text from each slide
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideXml = await zip.files[slideFile].async("text");
        const slideText = this.extractTextFromSlideXml(slideXml, i + 1);
        if (slideText.trim()) {
          slides.push(slideText);
        }
      }

      // Extract speaker notes
      const notesFiles = Object.keys(zip.files).filter((name) =>
        name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/)
      );

      for (const notesFile of notesFiles) {
        const notesXml = await zip.files[notesFile].async("text");
        const notesText = this.extractNotesText(notesXml);
        if (notesText.trim()) {
          const slideNum = notesFile.match(/notesSlide(\d+)/)?.[1];
          slides.push(`[Speaker Notes - Slide ${slideNum}]\n${notesText}`);
        }
      }

      // Extract images from media folder
      const mediaFiles = Object.keys(zip.files).filter(
        (name) =>
          name.startsWith("ppt/media/") &&
          (name.endsWith(".png") ||
            name.endsWith(".jpg") ||
            name.endsWith(".jpeg") ||
            name.endsWith(".gif") ||
            name.endsWith(".webp"))
      );

      for (const mediaFile of mediaFiles) {
        const imageBuffer = await zip.files[mediaFile].async("nodebuffer");
        const mimeType = this.detectImageMimeType(imageBuffer);

        images.push({
          base64: this.bufferToBase64(imageBuffer),
          mimeType,
          index: imageIndex++,
        });
      }

      const text = slides.join("\n\n");

      return {
        text: this.normalizeText(text),
        images,
        metadata: this.createMetadata(
          filename,
          this.supportedMimeTypes[0],
          file.length,
          text,
          images,
          "jszip+fast-xml-parser",
          startTime,
          {
            slideCount: slideFiles.length,
          }
        ),
      };
    } catch (error) {
      throw new ExtractionError(
        `Failed to extract PPTX from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
        this.name,
        error
      );
    }
  }

  /**
   * Extract text content from slide XML
   */
  private extractTextFromSlideXml(xml: string, slideNumber: number): string {
    try {
      const parsed = this.parser.parse(xml);
      const texts: string[] = [`[Slide ${slideNumber}]`];

      // Recursively extract all text nodes
      this.extractTextNodes(parsed, texts);

      return texts.join("\n");
    } catch {
      return "";
    }
  }

  /**
   * Extract speaker notes text
   */
  private extractNotesText(xml: string): string {
    try {
      const parsed = this.parser.parse(xml);
      const texts: string[] = [];
      this.extractTextNodes(parsed, texts);
      return texts.join("\n");
    } catch {
      return "";
    }
  }

  /**
   * Recursively extract text from XML structure
   */
  private extractTextNodes(obj: unknown, results: string[]): void {
    if (!obj || typeof obj !== "object") return;

    const record = obj as Record<string, unknown>;

    // Look for text content in common OOXML patterns
    if (record["a:t"] && typeof record["a:t"] === "string") {
      results.push(record["a:t"]);
    }
    if (record["#text"] && typeof record["#text"] === "string") {
      const text = record["#text"].trim();
      if (text) results.push(text);
    }

    // Recurse into children
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.extractTextNodes(item, results);
        }
      } else if (typeof value === "object") {
        this.extractTextNodes(value, results);
      }
    }
  }
}
