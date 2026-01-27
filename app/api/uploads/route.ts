// ============================================
// Document Upload API Route
// POST /api/uploads - Process documents from Blob URL (NO AI analysis)
// GET /api/uploads - List uploads for a project
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DocumentProcessor } from "@/lib/documents/processor";
import { validateFile, getMimeTypeFromExtension } from "@/lib/documents/types";
import { ExtractionStatus, AnalysisStatus } from "@/lib/types";

// Force Node.js runtime for file processing APIs
export const runtime = "nodejs";

// Allow up to 30 seconds for upload processing
export const maxDuration = 30;


// ============================================
// Types
// ============================================

interface UploadContextData {
  projectType?: string;
  businessDomain?: string;
  targetAudience?: string;
  documentType?: string;
  confidentiality?: string;
  sourceSystem?: string;
  notes?: string;
  keyTerms?: string;
}

interface UploadRequest {
  projectId: string;
  blobUrl: string;
  blobPathname: string;
  filename: string;
  fileType: string;
  fileSize: number;
  context?: UploadContextData;
}

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
// POST Handler - Process from Blob URL (No AI Analysis)
// Client uploads directly to Blob, then sends URL here for processing
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Parse JSON body (not FormData - file is already in Blob)
    const body = (await request.json()) as UploadRequest;
    const { projectId, blobUrl, blobPathname, filename, fileType, fileSize, context } = body;

    // Validate required fields
    if (!projectId || !blobUrl || !filename) {
      return NextResponse.json(
        { success: false, results: [], error: "projectId, blobUrl, and filename are required" },
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

    // Determine MIME type
    const mimeType = fileType || getMimeTypeFromExtension(filename) || "application/octet-stream";

    // Validate file type and size
    const validation = validateFile(mimeType, fileSize);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        results: [{
          uploadId: "",
          filename,
          success: false,
          error: validation.error,
        }],
      });
    }

    // Fetch file content from Blob URL
    let buffer: Buffer;
    try {
      const blobResponse = await fetch(blobUrl);
      if (!blobResponse.ok) {
        throw new Error(`Failed to fetch blob: ${blobResponse.status} ${blobResponse.statusText}`);
      }
      const arrayBuffer = await blobResponse.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (fetchError) {
      console.error("Blob fetch error:", fetchError);
      return NextResponse.json({
        success: false,
        results: [{
          uploadId: "",
          filename,
          success: false,
          error: "Failed to fetch file from storage",
        }],
      });
    }

    // Process document (extraction only)
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
          fileSize,
        },
      });

      return NextResponse.json({
        success: false,
        results: [{
          uploadId: upload.id,
          filename,
          success: false,
          error: processingResult.error,
        }],
      });
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

    // Store upload context if provided
    if (context && Object.keys(context).length > 0) {
      await db.uploadContext.create({
        data: {
          uploadId: upload.id,
          projectType: context.projectType,
          businessDomain: context.businessDomain,
          targetAudience: context.targetAudience,
          documentType: context.documentType,
          confidentiality: context.confidentiality,
          sourceSystem: context.sourceSystem,
          notes: context.notes,
          keyTerms: context.keyTerms,
        },
      });
    }

    return NextResponse.json({
      success: true,
      results: [{
        uploadId: upload.id,
        filename,
        success: true,
        wordCount: content.metadata.wordCount,
        hasImages: content.metadata.hasImages,
      }],
    });
  } catch (error) {
    console.error("Upload processing error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Upload processing failed",
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
