// ============================================
// Client Upload URL Generator
// POST /api/uploads/get-upload-url
// Returns signed URLs for direct client-to-Blob uploads
// ============================================

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SUPPORTED_FILE_TYPES } from "@/lib/documents/types";

// Force Node.js runtime
export const runtime = "nodejs";

// Get all supported MIME types from config
const ALLOWED_CONTENT_TYPES = Object.keys(SUPPORTED_FILE_TYPES);

// Max file size: 100MB (PPTX can be up to 100MB per config)
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Parse clientPayload to get projectId
        let projectId: string | undefined;
        if (clientPayload) {
          try {
            const payload = JSON.parse(clientPayload);
            projectId = payload.projectId;
          } catch {
            // clientPayload might not be JSON
            projectId = clientPayload;
          }
        }

        // Validate projectId exists
        if (projectId) {
          const project = await db.project.findUnique({
            where: { id: projectId },
            select: { id: true },
          });

          if (!project) {
            throw new Error("Project not found");
          }
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          tokenPayload: JSON.stringify({ projectId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Log upload completion for debugging
        console.log("Blob upload completed:", {
          pathname: blob.pathname,
          url: blob.url,
          tokenPayload,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Upload URL generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
