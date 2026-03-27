import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { getOpenBugReportCount } from "@/server/actions/bug-reports";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);
  const openBugReportCount = admin ? await getOpenBugReportCount() : 0;

  return (
    <AppShell user={user} isAdmin={admin} openBugReportCount={openBugReportCount}>
      <main id="main-content" role="main" className="min-h-screen">
        {children}
      </main>
    </AppShell>
  );
}
