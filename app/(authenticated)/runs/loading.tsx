import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/loading-states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RunsLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeaderSkeleton />

      <div className="flex-1 p-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={8} columns={6} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
