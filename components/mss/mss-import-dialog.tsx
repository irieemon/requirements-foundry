"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importMssFromCSV } from "@/server/actions/mss";
import { Upload, Loader2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PreviewRow {
  l2Code: string;
  l2Name: string;
  l3Code: string;
  l3Name: string;
  l4Code: string;
  l4Name: string;
}

export function MssImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  const resetState = () => {
    setCsvContent(null);
    setFileName(null);
    setPreviewData([]);
    setRowCount(0);
    setError(null);
    setDetectedColumns([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parsePreview(content);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  };

  const parsePreview = (content: string) => {
    // Strip BOM if present
    let cleanContent = content.replace(/^\uFEFF/, "");

    // Split into lines and filter empty
    let lines = cleanContent.split(/\r?\n/).filter(line => line.trim());

    // Skip first row if it's empty (all commas)
    if (lines.length > 0 && /^,*$/.test(lines[0].replace(/"/g, "").trim())) {
      lines = lines.slice(1);
    }

    if (lines.length < 2) {
      setError("CSV file appears to be empty or has no data rows");
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    setDetectedColumns(headers);

    // Simple column detection patterns - match various MSS CSV formats
    const findColumn = (patterns: RegExp[]) => {
      for (const header of headers) {
        const normalized = header.toLowerCase();
        for (const pattern of patterns) {
          if (pattern.test(normalized)) return headers.indexOf(header);
        }
      }
      return -1;
    };

    // Patterns support: "L2 Code", "Service Line", "Service (L2)" formats
    const l2CodeIdx = findColumn([/l2.*code/i, /service.*line.*code/i, /service\s*\(l2\)/i]);
    const l2NameIdx = findColumn([/l2.*name/i, /service.*line.*name/i, /service.*line$/i, /service\s*\(l2\)/i]);
    const l3CodeIdx = findColumn([/l3.*code/i, /service.*area.*code/i, /services?\s*\(l3\)/i]);
    const l3NameIdx = findColumn([/l3.*name/i, /service.*area.*name/i, /service.*area$/i, /services?\s*\(l3\)/i]);
    const l4CodeIdx = findColumn([/l4.*code/i, /activity.*code/i, /services?\s*\(l4\)/i]);
    const l4NameIdx = findColumn([/l4.*name/i, /activity.*name/i, /activity$/i, /services?\s*\(l4\)/i]);

    const missingColumns = [];
    if (l2CodeIdx === -1) missingColumns.push("L2 Code");
    if (l2NameIdx === -1) missingColumns.push("L2 Name");
    if (l3CodeIdx === -1) missingColumns.push("L3 Code");
    if (l3NameIdx === -1) missingColumns.push("L3 Name");
    if (l4CodeIdx === -1) missingColumns.push("L4 Code");
    if (l4NameIdx === -1) missingColumns.push("L4 Name");

    if (missingColumns.length > 0) {
      setError(`Could not detect columns: ${missingColumns.join(", ")}. Expected column names like 'L2 Code', 'L2 Name', etc.`);
      return;
    }

    // Parse preview rows (up to 5)
    const previewRows: PreviewRow[] = [];
    let validRowCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < Math.max(l2CodeIdx, l2NameIdx, l3CodeIdx, l3NameIdx, l4CodeIdx, l4NameIdx) + 1) {
        continue;
      }

      const l2Code = values[l2CodeIdx]?.trim();
      const l3Code = values[l3CodeIdx]?.trim();
      const l4Code = values[l4CodeIdx]?.trim();

      if (!l2Code || !l3Code || !l4Code) continue;

      validRowCount++;

      if (previewRows.length < 5) {
        previewRows.push({
          l2Code,
          l2Name: values[l2NameIdx]?.trim() || l2Code,
          l3Code,
          l3Name: values[l3NameIdx]?.trim() || l3Code,
          l4Code,
          l4Name: values[l4NameIdx]?.trim() || l4Code,
        });
      }
    }

    setPreviewData(previewRows);
    setRowCount(validRowCount);
  };

  // Simple CSV line parser that handles quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async () => {
    if (!csvContent) return;

    setLoading(true);
    setError(null);

    try {
      const result = await importMssFromCSV(csvContent);

      if (result.success) {
        const { data } = result;
        toast.success(
          `Imported ${data.serviceLines} service lines, ${data.serviceAreas} service areas, and ${data.activities} activities`
        );
        if (data.errors.length > 0) {
          toast.warning(`${data.errors.length} rows had issues during import`);
        }
        setOpen(false);
        resetState();
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("An unexpected error occurred during import");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Service Taxonomy</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing L2/L3/L4 service hierarchy. Expected columns: L2 Code,
            L2 Name, L3 Code, L3 Name, L4 Code, L4 Name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
              disabled={loading}
            />
            <label
              htmlFor="csv-file-input"
              className="flex flex-col items-center cursor-pointer"
            >
              {fileName ? (
                <>
                  <FileText className="h-10 w-10 text-primary mb-2" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Click to choose a different file
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium">Choose a CSV file</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    or drag and drop here
                  </span>
                </>
              )}
            </label>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Preview Section */}
          {previewData.length > 0 && !error && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Preview</h4>
                <span className="text-sm text-muted-foreground">
                  {rowCount} valid rows detected
                </span>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">L2 Code</th>
                        <th className="px-3 py-2 text-left font-medium">L2 Name</th>
                        <th className="px-3 py-2 text-left font-medium">L3 Code</th>
                        <th className="px-3 py-2 text-left font-medium">L3 Name</th>
                        <th className="px-3 py-2 text-left font-medium">L4 Code</th>
                        <th className="px-3 py-2 text-left font-medium">L4 Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono">{row.l2Code}</td>
                          <td className="px-3 py-2">{row.l2Name}</td>
                          <td className="px-3 py-2 font-mono">{row.l3Code}</td>
                          <td className="px-3 py-2">{row.l3Name}</td>
                          <td className="px-3 py-2 font-mono">{row.l4Code}</td>
                          <td className="px-3 py-2">{row.l4Name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rowCount > 5 && (
                  <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground text-center border-t">
                    ... and {rowCount - 5} more rows
                  </div>
                )}
              </div>

              {detectedColumns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Detected columns: {detectedColumns.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={loading || !csvContent || !!error}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {rowCount > 0 ? `${rowCount} rows` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
