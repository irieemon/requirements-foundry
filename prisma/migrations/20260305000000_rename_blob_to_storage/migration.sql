-- Rename Vercel Blob storage columns to generic storage columns
-- Supports S3 storage adapter (Phase 21 AWS Migration)

ALTER TABLE "Upload" RENAME COLUMN "blobUrl" TO "storageUrl";
ALTER TABLE "Upload" RENAME COLUMN "blobPathname" TO "storageKey";
