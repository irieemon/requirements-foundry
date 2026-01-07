import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { RunList } from "@/components/runs/run-list";

export default async function RunsPage() {
  const runs = await db.run.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      project: true,
    },
  });

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Generation Runs"
        description="History of all AI generation tasks across projects."
      />

      <div className="flex-1 p-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
            <CardDescription>Last 50 generation runs across all projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <RunList
              runs={runs.map((r) => ({
                ...r,
                projectName: r.project.name,
              }))}
              showProject
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
