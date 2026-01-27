import { getMssCoverageStats, getMssCoverageByServiceLine } from "@/server/actions/mss";
import { MssCoverageCard } from "@/components/mss/mss-coverage-card";
import { MssServiceLineCoverageList } from "@/components/mss/mss-service-line-coverage";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function MssDashboardPage() {
  const [coverageResult, serviceLineResult] = await Promise.all([
    getMssCoverageStats(),
    getMssCoverageByServiceLine(),
  ]);

  const hasError = !coverageResult.success || !serviceLineResult.success;
  const errorMessage = !coverageResult.success
    ? coverageResult.error
    : !serviceLineResult.success
      ? serviceLineResult.error
      : null;

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="MSS Dashboard"
        description="Coverage metrics and service line breakdown"
        backHref="/mss"
        backLabel="Back to Service Taxonomy"
      />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {hasError ? (
            <Card className="p-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p>{errorMessage || "Failed to load dashboard data"}</p>
              </div>
            </Card>
          ) : (
            <>
              <MssCoverageCard stats={coverageResult.data} />
              <MssServiceLineCoverageList coverage={serviceLineResult.data} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
