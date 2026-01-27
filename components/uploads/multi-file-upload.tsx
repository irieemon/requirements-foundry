"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload as UploadIcon,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAcceptString } from "@/lib/documents/types";
import { UploadContextForm } from "@/components/uploads/upload-context-form";
import type { UploadContextFormData } from "@/lib/uploads/context-schema";

// ============================================
// Types
// ============================================

interface FileWithPreview {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "success" | "error";
  error?: string;
  wordCount?: number;
  blobUrl?: string;
  progress?: number;
}

interface UploadResult {
  uploadId: string;
  filename: string;
  success: boolean;
  error?: string;
  wordCount?: number;
}

interface ProcessUploadRequest {
  projectId: string;
  blobUrl: string;
  blobPathname: string;
  filename: string;
  fileType: string;
  fileSize: number;
  context?: UploadContextFormData;
}

interface MultiFileUploadProps {
  projectId: string;
  onUploadComplete?: (results: UploadResult[]) => void;
}

// ============================================
// Utilities
// ============================================

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv")
    return FileSpreadsheet;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ============================================
// Component
// ============================================

export function MultiFileUpload({ projectId, onUploadComplete }: MultiFileUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showContextForm, setShowContextForm] = useState(false);
  const [contextData, setContextData] = useState<UploadContextFormData | null>(null);

  const acceptString = getAcceptString();

  // ============================================
  // File Handling
  // ============================================

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const newFileItems: FileWithPreview[] = fileArray.map((file) => ({
      file,
      id: generateId(),
      status: "pending",
    }));
    setFiles((prev) => {
      const updated = [...prev, ...newFileItems];
      // Show context form when first files are added
      if (prev.length === 0 && updated.length > 0) {
        setShowContextForm(true);
      }
      return updated;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress(0);
    setShowContextForm(false);
    setContextData(null);
  }, []);

  // ============================================
  // Drag & Drop
  // ============================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  // ============================================
  // Upload (Two-phase: Client → Blob, then Blob URL → API)
  // ============================================

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    const results: UploadResult[] = [];
    const totalFiles = files.length;

    // Process files sequentially to show individual progress
    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];
      const { file, id } = fileItem;

      // Mark this file as uploading
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "uploading" as const, progress: 0 } : f))
      );

      try {
        // Step 1: Upload directly to Blob (bypasses 4.5MB serverless limit)
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/uploads/get-upload-url",
          clientPayload: JSON.stringify({ projectId }),
          onUploadProgress: ({ percentage }) => {
            // Update individual file progress
            setFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, progress: percentage } : f))
            );
            // Update overall progress (blob upload is ~50% of total work)
            const fileProgress = (i + percentage / 100) / totalFiles;
            setProgress(Math.round(fileProgress * 50));
          },
        });

        // Mark as processing (API step)
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "processing" as const, blobUrl: blob.url } : f
          )
        );

        // Step 2: Call API with blob URL for document processing
        const processRequest: ProcessUploadRequest = {
          projectId,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          filename: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          ...(contextData && Object.keys(contextData).length > 0 && { context: contextData }),
        };

        const response = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(processRequest),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Processing failed: ${response.statusText}`);
        }

        const data = await response.json();
        const result = data.results?.[0];

        if (result?.success) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "success" as const, wordCount: result.wordCount }
                : f
            )
          );
          results.push(result);
        } else {
          throw new Error(result?.error || "Processing failed");
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Upload failed";
        console.error(`Upload error for ${file.name}:`, error);

        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error" as const, error: errorMsg } : f))
        );

        results.push({
          uploadId: "",
          filename: file.name,
          success: false,
          error: errorMsg,
        });
      }

      // Update overall progress
      setProgress(Math.round(((i + 1) / totalFiles) * 100));
    }

    // Show summary toast
    const successCount = results.filter((r) => r.success).length;
    if (successCount === results.length && successCount > 0) {
      toast.success(`${successCount} document(s) uploaded - ready for analysis`);
    } else if (successCount > 0) {
      toast.warning(`${successCount}/${results.length} documents uploaded`);
    } else if (results.length > 0) {
      toast.error("Upload failed");
    }

    // Callback and refresh
    if (results.length > 0) {
      onUploadComplete?.(results);
      router.refresh();
    }

    setUploading(false);
  };

  // ============================================
  // Context Form Handlers
  // ============================================

  const handleContextSubmit = useCallback((data: UploadContextFormData) => {
    setContextData(data);
    setShowContextForm(false);
    // Auto-start upload after context is provided
    // We'll trigger upload in useEffect or let user click button
  }, []);

  const handleContextSkip = useCallback(() => {
    setContextData(null);
    setShowContextForm(false);
  }, []);

  // ============================================
  // Render
  // ============================================

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const contextReady = !showContextForm; // Context form completed or skipped

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploading && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptString}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          multiple
          disabled={uploading}
        />

        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <FileText className="h-6 w-6" />
            <File className="h-6 w-6" />
            <FileImage className="h-6 w-6" />
            <FileSpreadsheet className="h-6 w-6" />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supports: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, JPG, WebP, GIF
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{files.length} file(s) selected</span>
            <Button variant="ghost" size="sm" onClick={clearFiles} disabled={uploading}>
              Clear all
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((item) => {
              const Icon = getFileIcon(item.file.type);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    item.status === "success" && "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
                    item.status === "error" && "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                  )}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                        {item.wordCount !== undefined && ` • ${item.wordCount.toLocaleString()} words`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.status === "uploading" && (
                      <div className="flex items-center space-x-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {item.progress !== undefined && (
                          <span className="text-xs text-muted-foreground">{item.progress}%</span>
                        )}
                      </div>
                    )}
                    {item.status === "processing" && (
                      <div className="flex items-center space-x-1">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-xs text-muted-foreground">Processing</span>
                      </div>
                    )}
                    {item.status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {item.status === "error" && (
                      <span title={item.error}>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      </span>
                    )}
                    {item.status === "pending" && !uploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(item.id);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progress < 100 ? "Processing..." : "Complete!"}
              </p>
            </div>
          )}

          {/* Summary Badges */}
          {(successCount > 0 || errorCount > 0) && (
            <div className="flex gap-2">
              {successCount > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {successCount} succeeded
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {errorCount} failed
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Context Form - shown after files selected, before upload */}
      {files.length > 0 && pendingCount > 0 && showContextForm && !uploading && (
        <Card>
          <CardContent className="pt-4">
            <UploadContextForm
              onSubmit={handleContextSubmit}
              onSkip={handleContextSkip}
            />
          </CardContent>
        </Card>
      )}

      {/* Upload Button - shown after context form is completed/skipped */}
      {files.length > 0 && pendingCount > 0 && contextReady && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {contextData && Object.keys(contextData).length > 0 && (
            <span className="text-xs text-muted-foreground">
              ✓ Context provided
            </span>
          )}
          <Button onClick={handleUpload} disabled={uploading || pendingCount === 0}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload {pendingCount} file(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
