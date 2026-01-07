// ============================================
// Document Upload API Route
// POST /api/uploads - Extract and store documents (NO AI analysis)
// GET /api/uploads - List uploads for a project
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DocumentProcessor } from "@/lib/documents/processor";
import { validateFile, getMimeTypeFromExtension } from "@/lib/documents/types";
import { ExtractionStatus, AnalysisStatus } from "@/lib/types";
import { uploadToStorage, isBlobMode } from "@/lib/storage";

// Force Node.js runtime for file processing APIs
export const runtime = "nodejs";

// Allow up to 30 seconds for upload processing
export const maxDuration = 30;

// ============================================
// Types
// ============================================

interface UploadResult {
  uploadId: string;
  filename: string;
  success: boolean;
  error?: string;
  wordCount?: number;
  hasImages?: boolean;
}

interface UploadResponse {
  success: boolean;
  results: UploadResult[];
  error?: string;
}

// ============================================
// POST Handler - Extraction Only (No AI Analysis)
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Parse form data
    const formData = await request.formData();
    const projectId = formData.get("projectId") as string;

    if (!projectId) {
      return NextResponse.json(
        { success: false, results: [], error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, results: [], error: "Project not found" },
        { status: 404 }
      );
    }

    // Get all files from form data
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, results: [], error: "No files provided" },
        { status: 400 }
      );
    }

    // Process each file (extraction only - no AI analysis)
    const results: UploadResult[] = [];
    const useBlobStorage = isBlobMode();

    for (const file of files) {
      const filename = file.name;
      const mimeType = file.type || getMimeTypeFromExtension(filename) || "application/octet-stream";

      // Validate file
      const validation = validateFile(mimeType, file.size);
      if (!validation.valid) {
        results.push({
          uploadId: "",
          filename,
          success: false,
          error: validation.error,
        });
        continue;
      }

      // Convert to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to blob storage if in blob mode
      let blobUrl: string | undefined;
      let blobPathname: string | undefined;

      if (useBlobStorage) {
        try {
          const storageResult = await uploadToStorage(buffer, filename, mimeType);
          blobUrl = storageResult.blobUrl;
          blobPathname = storageResult.blobPathname;
        } catch (storageError) {
          console.error("Blob upload error:", storageError);
          results.push({
            uploadId: "",
            filename,
            success: false,
            error: "Failed to upload to storage",
          });
          continue;
        }
      }

      // Process document (extraction only)
      // In blob mode, we already have the buffer from the upload
      // In local mode, we use the buffer directly
      const processingResult = await DocumentProcessor.process(buffer, filename, mimeType);

      if (!processingResult.success || !processingResult.content) {
        // Create failed upload record
        const upload = await db.upload.create({
          data: {
            projectId,
            filename,
            fileType: mimeType,
            rawContent: "",
            blobUrl,
            blobPathname,
            extractionStatus: ExtractionStatus.FAILED,
            analysisStatus: AnalysisStatus.PENDING,
            errorMsg: processingResult.error || "Processing failed",
            errorPhase: "extraction",
            fileSize: file.size,
          },
        });

        results.push({
          uploadId: upload.id,
          filename,
          success: false,
          error: processingResult.error,
        });
        continue;
      }

      const { content } = processingResult;

      // Create upload record with EXTRACTED status, PENDING analysis
      const upload = await db.upload.create({
        data: {
          projectId,
          filename,
          fileType: mimeType,
          rawContent: content.text,
          blobUrl,
          blobPathname,
          extractionStatus: ExtractionStatus.EXTRACTED,
          analysisStatus: AnalysisStatus.PENDING,
          fileSize: content.metadata.fileSize,
          processingMethod: content.metadata.extractionMethod,
          pageCount: content.metadata.pageCount,
          slideCount: content.metadata.slideCount,
          sheetCount: content.metadata.sheetCount,
          wordCount: content.metadata.wordCount,
          hasImages: content.metadata.hasImages,
          processingTimeMs: content.metadata.processingTimeMs,
        },
      });

      // Store extracted images (truncate very large base64 to avoid DB bloat)
      if (content.images.length > 0) {
        const MAX_IMAGE_BASE64_SIZE = 500_000; // ~375KB per image
        await db.documentImage.createMany({
          data: content.images.map((img) => ({
            uploadId: upload.id,
            base64: img.base64.length > MAX_IMAGE_BASE64_SIZE
              ? img.base64.substring(0, MAX_IMAGE_BASE64_SIZE)
              : img.base64,
            mimeType: img.mimeType,
            index: img.index,
            pageNumber: img.pageNumber,
            slideNumber: img.slideNumber,
            width: img.width,
            height: img.height,
            description: img.description,
          })),
        });
      }

      results.push({
        uploadId: upload.id,
        filename,
        success: true,
        wordCount: content.metadata.wordCount,
        hasImages: content.metadata.hasImages,
      });
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      results,
    });
  } catch (error) {
    console.error("Upload error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET Handler - List uploads for a project
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const uploads = await db.upload.findMany({
      where: { projectId },
      include: {
        images: {
          select: {
            id: true,
            mimeType: true,
            index: true,
            pageNumber: true,
            width: true,
            height: true,
          },
        },
        _count: {
          select: { cards: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Get uploads error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get uploads" },
      { status: 500 }
    );
  }
}
