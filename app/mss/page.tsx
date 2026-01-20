import { getMssHierarchy, getMssStats } from "@/server/actions/mss";
import { MssHierarchyViewer } from "@/components/mss/mss-hierarchy-viewer";
import { MssImportDialog } from "@/components/mss/mss-import-dialog";
import { MssStatsCard } from "@/components/mss/mss-stats-card";
import { MssClearDialog } from "@/components/mss/mss-clear-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Upload } from "lucide-react";

export default async function MssPage() {
  const [hierarchyResult, statsResult] = await Promise.all([
    getMssHierarchy(),
    getMssStats(),
  ]);

  const serviceLines = hierarchyResult.success && hierarchyResult.data ? hierarchyResult.data : [];
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Service Taxonomy"
        description="Manage L2/L3/L4 service hierarchy"
        actions={
          <div className="flex items-center gap-2">
            <MssImportDialog />
            <MssClearDialog stats={stats} />
          </div>
        }
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {serviceLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No service taxonomy loaded</h2>
              <p className="text-muted-foreground max-w-sm">
                Import a CSV to get started. The taxonomy defines the L2/L3/L4 service
                hierarchy used for categorizing requirements.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {stats && <MssStatsCard initialStats={stats} />}
              <MssHierarchyViewer serviceLines={serviceLines} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
