"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for the run detail page.
 * Matches the layout of RunDetailClient for smooth transitions.
 */
export function RunSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-32 ml-10" />
        </div>
      </div>

      {/* Duration */}
      <Skeleton className="h-5 w-40" />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline column */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Phase skeletons */}
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Logs card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[120px] w-full rounded" />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4">
          {/* Counts grid */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details card */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact skeleton for run list items.
 */
export function RunListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-12 ml-auto" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/**
 * Skeleton for the analyze button area.
 */
export function AnalyzeButtonSkeleton() {
  return <Skeleton className="h-10 w-36" />;
}
