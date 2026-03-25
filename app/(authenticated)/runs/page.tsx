import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { RunList } from "@/components/runs/run-list";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import type { Prisma } from "@prisma/client";

export default async function RunsPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  let where: Prisma.RunWhereInput = {};
  if (!admin) {
    // Look up User.id for share query (ProjectShare.userId is FK to User.id)
    const dbUser = await db.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    where = {
      OR: [
        { project: { userId: user.email } },
        ...(dbUser
          ? [{ project: { shares: { some: { userId: dbUser.id } } } }]
          : []),
      ],
    };
  }

  const runs = await db.run.findMany({
    where,
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
        <div className="max-w-7xl mx-auto">
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
    </div>
  );
}
