import { getMssHierarchy } from "@/server/actions/mss";
import { MssHierarchyViewer } from "@/components/mss/mss-hierarchy-viewer";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default async function MssPage() {
  const result = await getMssHierarchy();
  const serviceLines = result.success && result.data ? result.data : [];

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Service Taxonomy"
        description="Manage L2/L3/L4 service hierarchy"
        actions={
          <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
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
            <MssHierarchyViewer serviceLines={serviceLines} />
          )}
        </div>
      </div>
    </div>
  );
}
