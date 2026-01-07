"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createUploadFromText, createUploadFromCSV } from "@/server/actions/uploads";
import { Upload, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  projectId: string;
}

export function FileUpload({ projectId }: FileUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["txt", "md", "csv"];

    if (!extension || !allowedExtensions.includes(extension)) {
      toast.error("Unsupported file type. Please upload .txt, .md, or .csv files.");
      return;
    }

    setLoading(true);
    try {
      const content = await file.text();

      let result;
      if (extension === "csv") {
        result = await createUploadFromCSV(projectId, content, file.name);
      } else {
        result = await createUploadFromText(projectId, content, file.name);
      }

      if (result.success) {
        toast.success(`Extracted ${result.cardCount} cards from ${file.name}`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to process file");
      }
    } catch (error) {
      toast.error("Failed to upload file");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        loading && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv"
        onChange={handleChange}
        className="hidden"
        disabled={loading}
      />

      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <FileSpreadsheet className="h-8 w-8" />
        </div>

        <div>
          <p className="text-sm font-medium mb-1">
            {loading ? "Processing..." : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground">Supports .txt, .md, and .csv files</p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Choose File
        </Button>
      </div>
    </div>
  );
}
