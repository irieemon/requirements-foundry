/*
  Warnings:

  - You are about to drop the column `status` on the `Upload` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Card" ADD COLUMN "runId" TEXT;

-- CreateTable
CREATE TABLE "DocumentImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "base64" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "slideNumber" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentImage_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "durationMs" INTEGER,
    "tokensUsed" INTEGER,
    "cardsCreated" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunUpload_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RunUpload_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "phase" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "phaseDetail" TEXT,
    "inputConfig" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "totalCards" INTEGER NOT NULL DEFAULT 0,
    "outputData" TEXT,
    "errorMsg" TEXT,
    "logs" TEXT,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Run" ("completedAt", "createdAt", "durationMs", "errorMsg", "id", "inputConfig", "logs", "outputData", "projectId", "startedAt", "status", "tokensUsed", "type") SELECT "completedAt", "createdAt", "durationMs", "errorMsg", "id", "inputConfig", "logs", "outputData", "projectId", "startedAt", "status", "tokensUsed", "type" FROM "Run";
DROP TABLE "Run";
ALTER TABLE "new_Run" RENAME TO "Run";
CREATE INDEX "Run_projectId_idx" ON "Run"("projectId");
CREATE INDEX "Run_status_idx" ON "Run"("status");
CREATE INDEX "Run_type_idx" ON "Run"("type");
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");
CREATE INDEX "Run_projectId_status_idx" ON "Run"("projectId", "status");
CREATE TABLE "new_Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "filename" TEXT,
    "fileType" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "filePath" TEXT,
    "extractionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "errorPhase" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileSize" INTEGER,
    "processingMethod" TEXT,
    "pageCount" INTEGER,
    "slideCount" INTEGER,
    "sheetCount" INTEGER,
    "wordCount" INTEGER,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "processingTimeMs" INTEGER,
    "lastAnalyzedRunId" TEXT,
    "lastAnalyzedAt" DATETIME,
    CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Upload" ("createdAt", "errorMsg", "filePath", "fileType", "filename", "id", "projectId", "rawContent") SELECT "createdAt", "errorMsg", "filePath", "fileType", "filename", "id", "projectId", "rawContent" FROM "Upload";
DROP TABLE "Upload";
ALTER TABLE "new_Upload" RENAME TO "Upload";
CREATE INDEX "Upload_projectId_idx" ON "Upload"("projectId");
CREATE INDEX "Upload_extractionStatus_idx" ON "Upload"("extractionStatus");
CREATE INDEX "Upload_analysisStatus_idx" ON "Upload"("analysisStatus");
CREATE INDEX "Upload_projectId_analysisStatus_idx" ON "Upload"("projectId", "analysisStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DocumentImage_uploadId_idx" ON "DocumentImage"("uploadId");

-- CreateIndex
CREATE INDEX "RunUpload_runId_idx" ON "RunUpload"("runId");

-- CreateIndex
CREATE INDEX "RunUpload_uploadId_idx" ON "RunUpload"("uploadId");

-- CreateIndex
CREATE INDEX "RunUpload_runId_status_idx" ON "RunUpload"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RunUpload_runId_uploadId_key" ON "RunUpload"("runId", "uploadId");

-- CreateIndex
CREATE INDEX "Card_runId_idx" ON "Card"("runId");
