"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
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

// ============================================
// Types
// ============================================

interface FileWithPreview {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  wordCount?: number;
}

interface UploadResult {
  uploadId: string;
  filename: string;
  success: boolean;
  error?: string;
  wordCount?: number;
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
    setFiles((prev) => [...prev, ...newFileItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setProgress(0);
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
  // Upload
  // ============================================

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    // Mark all files as uploading
    setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as const })));

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);

      for (const { file } of files) {
        formData.append("files", file);
      }

      // Simulate progress (actual progress would need XHR)
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 500);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Update file statuses based on results
      setFiles((prev) =>
        prev.map((f) => {
          const result = data.results.find((r: UploadResult) => r.filename === f.file.name);
          if (result) {
            return {
              ...f,
              status: result.success ? ("success" as const) : ("error" as const),
              error: result.error,
              wordCount: result.wordCount,
            };
          }
          return { ...f, status: "error" as const, error: "No result returned" };
        })
      );

      // Show summary toast
      const successCount = data.results.filter((r: UploadResult) => r.success).length;
      if (successCount === data.results.length) {
        toast.success(`${successCount} document(s) uploaded - ready for analysis`);
      } else if (successCount > 0) {
        toast.warning(`${successCount}/${data.results.length} documents uploaded`);
      } else {
        toast.error("Upload failed");
      }

      // Callback and refresh
      onUploadComplete?.(data.results);
      router.refresh();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");

      // Mark all as error
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Upload failed",
        }))
      );
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;

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
                    {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {/* Upload Button */}
      {files.length > 0 && pendingCount > 0 && (
        <div className="flex items-center justify-end pt-2 border-t">
          <Button onClick={handleUpload} disabled={uploading || pendingCount === 0}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {pendingCount} file(s)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
