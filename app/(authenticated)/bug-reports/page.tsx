import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { getBugReports } from "@/server/actions/bug-reports";
import { PageHeader } from "@/components/layout/page-header";
import { BugReportTable } from "@/components/bug-reports/bug-report-table";

export default async function BugReportsPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user.email)) {
    redirect("/projects");
  }
  const reports = await getBugReports();
  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Bug Reports"
        description="Review and manage bug reports submitted by users."
      />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <BugReportTable reports={reports} />
        </div>
      </div>
    </div>
  );
}
