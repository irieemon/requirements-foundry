// ============================================
// Storage Abstraction
// Supports local (buffer) and S3 modes
// ============================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export type StorageMode = "local" | "s3";

export interface StoredFile {
  buffer: Buffer;
  storageUrl?: string;
  storageKey?: string;
}

export interface UploadResult {
  storageUrl?: string;
  storageKey?: string;
}

// S3 client singleton (lazy-initialized)
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return _s3Client;
}

// Credential caching for auto-detection
let _hasCredentials: boolean | null = null;

async function hasAwsCredentials(): Promise<boolean> {
  if (_hasCredentials !== null) return _hasCredentials;
  try {
    const provider = fromNodeProviderChain();
    await provider();
    _hasCredentials = true;
  } catch {
    _hasCredentials = false;
  }
  return _hasCredentials;
}

// Get current storage mode from environment (async due to credential check)
export async function getStorageMode(): Promise<StorageMode> {
  const envMode = process.env.UPLOAD_STORAGE;

  // Explicit override
  if (envMode === "s3") return "s3";
  if (envMode === "local") return "local";

  // Auto-detect: use S3 if credentials available, otherwise local
  const hasCreds = await hasAwsCredentials();
  return hasCreds ? "s3" : "local";
}

// Check if we're in S3 storage mode
export async function isS3Mode(): Promise<boolean> {
  return (await getStorageMode()) === "s3";
}

// ============================================
// Upload file to storage
// Returns S3 info if in S3 mode, otherwise just passes through
// ============================================

export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const mode = await getStorageMode();

  if (mode === "s3") {
    const key = `uploads/${Date.now()}-${filename}`;
    const client = getS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return {
      storageUrl: `s3://${BUCKET_NAME}/${key}`,
      storageKey: key,
    };
  }

  // Local mode - no remote storage
  return {};
}

// ============================================
// Get file buffer from storage
// In S3 mode, fetches from S3; in local mode, returns provided buffer
// ============================================

export async function getFileBuffer(
  localBuffer: Buffer | null,
  storageKey?: string | null
): Promise<Buffer> {
  const mode = await getStorageMode();

  if (mode === "s3" && storageKey) {
    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      })
    );

    const byteArray = await response.Body!.transformToByteArray();
    return Buffer.from(byteArray);
  }

  // Local mode - use provided buffer
  if (!localBuffer) {
    throw new Error("No buffer available in local mode");
  }
  return localBuffer;
}

// ============================================
// Delete file from S3 storage (if applicable)
// ============================================

export async function deleteFromStorage(storageKey?: string | null): Promise<void> {
  if (!storageKey) return;

  const mode = await getStorageMode();
  if (mode === "s3") {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: storageKey,
        })
      );
    } catch (error) {
      // Log but don't throw - file might already be deleted
      console.warn("Failed to delete from S3:", error);
    }
  }
}
