import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/authorization";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const admin = isAdmin(user.email);

  return (
    <AppShell user={user} isAdmin={admin}>
      <main id="main-content" role="main" className="min-h-screen">
        {children}
      </main>
    </AppShell>
  );
}
