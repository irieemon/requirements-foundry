// ============================================
// Storage Abstraction
// Supports local (buffer) and blob (Vercel Blob) modes
// ============================================

import { put, del } from "@vercel/blob";

export type StorageMode = "local" | "blob";

export interface StoredFile {
  buffer: Buffer;
  blobUrl?: string;
  blobPathname?: string;
}

export interface UploadResult {
  blobUrl?: string;
  blobPathname?: string;
}

// Get current storage mode from environment
export function getStorageMode(): StorageMode {
  const mode = process.env.UPLOAD_STORAGE || "local";
  if (mode !== "local" && mode !== "blob") {
    console.warn(`Invalid UPLOAD_STORAGE value: ${mode}, defaulting to "local"`);
    return "local";
  }
  return mode;
}

// Check if we're in blob storage mode
export function isBlobMode(): boolean {
  return getStorageMode() === "blob";
}

// ============================================
// Upload file to storage
// Returns blob info if in blob mode, otherwise just passes through
// ============================================

export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const mode = getStorageMode();

  if (mode === "blob") {
    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
    });

    return {
      blobUrl: blob.url,
      blobPathname: blob.pathname,
    };
  }

  // Local mode - no blob storage
  return {};
}

// ============================================
// Get file buffer from storage
// In blob mode, fetches from URL; in local mode, returns provided buffer
// ============================================

export async function getFileBuffer(
  localBuffer: Buffer | null,
  blobUrl?: string | null
): Promise<Buffer> {
  const mode = getStorageMode();

  if (mode === "blob" && blobUrl) {
    // Fetch from Vercel Blob
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Local mode - use provided buffer
  if (!localBuffer) {
    throw new Error("No buffer available in local mode");
  }
  return localBuffer;
}

// ============================================
// Delete file from blob storage (if applicable)
// ============================================

export async function deleteFromStorage(blobUrl?: string | null): Promise<void> {
  if (!blobUrl) return;

  const mode = getStorageMode();
  if (mode === "blob") {
    try {
      await del(blobUrl);
    } catch (error) {
      // Log but don't throw - file might already be deleted
      console.warn("Failed to delete blob:", error);
    }
  }
}
