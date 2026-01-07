import {
  PageHeaderSkeleton,
  KpiStripSkeleton,
  TabsSkeleton,
  RunProgressSkeleton,
} from "@/components/ui/loading-states";

export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <PageHeaderSkeleton />

      <div className="flex-1 p-6 space-y-6">
        {/* KPI Strip */}
        <KpiStripSkeleton />

        {/* Main content grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Tabs */}
          <div className="lg:col-span-2">
            <TabsSkeleton tabs={4} />
          </div>

          {/* Right column - Run Progress */}
          <div className="lg:col-span-1">
            <RunProgressSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
